import streamlit as st
import requests
import pandas as pd
import time

# Configure page
st.set_page_config(page_title="Trading Bot Dashboard", layout="wide", page_icon="📈")

# Constants
API_URL = "http://127.0.0.1:8000/api"

# Helper to fetch data
def fetch_data(endpoint):
    try:
        response = requests.get(f"{API_URL}/{endpoint}")
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        return None

# Helper to post data
def post_data(endpoint, payload):
    try:
        response = requests.post(f"{API_URL}/{endpoint}", json=payload)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        st.error(f"Error posting data to API: {e}")
        return None

# Sidebar for controls
with st.sidebar:
    st.header("⚙️ Controls & Settings")
    
    currency_pref = st.selectbox("Display Currency", ["USD", "INR", "EUR"])
    
    st.divider()
    
    st.subheader("💰 Add Funds")
    fund_currency = st.selectbox("Currency to Add", ["USD", "INR", "EUR"])
    fund_amount = st.number_input("Amount", min_value=1.0, value=1000.0, step=100.0)
    clear_history = st.checkbox("Clear History", value=False, help="This will wipe all existing trades and positions.")
    
    if st.button("Add Funds", type="primary"):
        res = post_data("add-funds", {
            "currency": fund_currency,
            "amount": fund_amount,
            "clear_history": clear_history
        })
        if res and res.get("status") == "success":
            st.success(res.get("message"))
            time.sleep(1)
            st.rerun()

    st.divider()
    
    st.markdown("### Data Refresh")
    st.caption("The dashboard does not auto-refresh. Click below to fetch the latest data from the bot.")
    if st.button("🔄 Refresh Data", use_container_width=True):
        st.rerun()

# Main Dashboard
st.title("📈 Crypto Trading Bot Dashboard")

# Fetch data
balances = fetch_data("balances")
positions = fetch_data("positions")
total_profit = fetch_data(f"total-profit?currency={currency_pref}")
invested = fetch_data("invested")
trades = fetch_data("trades")

if balances is None or total_profit is None or invested is None:
    st.error("Cannot connect to the Trading Bot API. Is the backend running? (Expecting http://127.0.0.1:8000)")
    st.stop()

# Top Metrics
st.subheader("Portfolio Summary")
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(
        label=f"Available Balance ({currency_pref})", 
        value=f"{currency_pref} {balances.get(currency_pref, 0):,.2f}"
    )
with col2:
    st.metric(
        label=f"Total Invested ({currency_pref})", 
        value=f"{currency_pref} {invested.get(currency_pref, 0):,.2f}"
    )
with col3:
    profit_val = total_profit.get("total_profit", 0)
    st.metric(
        label=f"Total Profit ({currency_pref})", 
        value=f"{currency_pref} {profit_val:,.2f}",
        delta=f"{profit_val:,.2f}"
    )
with col4:
    # Calculate Total Portfolio Value in selected fiat currency
    total_value = balances.get(currency_pref, 0) + invested.get(currency_pref, 0)
    st.metric(
        label=f"Total Portfolio Value ({currency_pref})",
        value=f"{currency_pref} {total_value:,.2f}"
    )

st.divider()

if positions:
    st.subheader("Active Positions")
    pos_data = positions.get("BTC/USDT", {})
    if pos_data and pos_data.get("amount", 0) > 0:
        p_col1, p_col2, p_col3, p_col4 = st.columns(4)
        p_col1.metric("Symbol", "BTC/USDT")
        p_col2.metric("Amount (BTC)", f"{pos_data.get('amount', 0):.6f}")
        p_col3.metric("Avg Price (USDT)", f"${pos_data.get('average_price_usd', 0):,.2f}")
        
        current_value = pos_data.get('amount', 0) * pos_data.get('average_price_usd', 0)
        p_col4.metric("Position Value (USD Est)", f"${current_value:,.2f}")
    else:
        st.info("No active positions currently held.")

st.divider()

st.subheader("Recent Trades")
if trades:
    df = pd.DataFrame(trades)
    if not df.empty:
        display_df = df.copy()
        
        # Adjust timestamp display
        display_df['timestamp'] = pd.to_datetime(display_df['timestamp']).dt.strftime('%Y-%m-%d %H:%M:%S')
        
        # Filter for display columns
        cols = ['timestamp', 'symbol', 'side', 'amount', 'price', 'fee', 'pnl_fiat', 'pnl_percent']
        existing_cols = [c for c in cols if c in display_df.columns]
        display_df = display_df[existing_cols]
        
        # Highlight PnL columns
        def style_pnl(val):
            try:
                v = float(val)
                if v > 0:
                    return 'color: #00C853; font-weight: bold;'
                elif v < 0:
                    return 'color: #D50000; font-weight: bold;'
                return ''
            except:
                return ''

        styled_df = display_df.style.map(
            style_pnl, 
            subset=[c for c in ['pnl_fiat', 'pnl_percent'] if c in display_df.columns]
        )
        
        st.dataframe(styled_df, use_container_width=True, hide_index=True)
    else:
        st.info("No trades executed yet.")
else:
    st.info("No trades executed yet.")
