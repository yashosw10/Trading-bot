import sqlite3
import pandas as pd
import pandas_ta as ta
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import os

DB_PATH = "history.db"
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "rf_model.pkl")

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Calculates technical features for the ML model."""
    print("Engineering features...")
    
    # 1. Trend & Momentum
    df['rsi'] = df.ta.rsi(length=14)
    df['macd'] = df.ta.macd(fast=12, slow=26, signal=9)['MACD_12_26_9']
    
    # 3. Z-Score (Mean Reversion)
    rolling_mean = df['close'].rolling(window=20).mean()
    rolling_std = df['close'].rolling(window=20).std()
    df['z_score'] = (df['close'] - rolling_mean) / rolling_std
    
    # Drop rows with NaN values after indicator calculation
    df.dropna(inplace=True)
    return df

def label_data(df: pd.DataFrame, forward_candles=15, target_profit_pct=1.0, stop_loss_pct=1.0) -> pd.DataFrame:
    """
    Labels row as 1 (Buy) if price hits target_profit before stop_loss within forward_candles.
    Otherwise 0.
    """
    print("Labeling target data...")
    labels = []
    
    close_prices = df['close'].values
    high_prices = df['high'].values
    low_prices = df['low'].values
    
    for i in range(len(df)):
        if i + forward_candles >= len(df):
            labels.append(np.nan)
            continue
            
        entry_price = close_prices[i]
        target_price = entry_price * (1 + target_profit_pct / 100)
        stop_price = entry_price * (1 - stop_loss_pct / 100)
        
        hit_target = False
        hit_stop = False
        
        # Look forward
        for j in range(1, forward_candles + 1):
            if low_prices[i+j] <= stop_price:
                hit_stop = True
                break
            if high_prices[i+j] >= target_price:
                hit_target = True
                break
                
        if hit_target and not hit_stop:
            labels.append(1)
        else:
            labels.append(0)
            
    df['target'] = labels
    df.dropna(inplace=True)
    return df

def train_model(symbol="BINANCE:BTC/USDT"):
    print(f"--- Training ML Model for {symbol} ---")
    
    # 1. Load Data
    conn = sqlite3.connect(DB_PATH)
    query = f"SELECT timestamp, open, high, low, close, volume FROM candles WHERE symbol = '{symbol}' ORDER BY timestamp ASC"
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if df.empty:
        print("Error: No data found.")
        return
        
    print(f"Loaded {len(df)} candles from DB.")
    
    # 2. Engineer Features
    df = engineer_features(df)
    
    # 3. Label Data
    df = label_data(df, forward_candles=15, target_profit_pct=1.0, stop_loss_pct=1.0)
    
    # 4. Define Features (X) and Target (y)
    feature_cols = ['rsi', 'macd', 'z_score']
    X = df[feature_cols]
    y = df['target']
    
    # We use a time-series split (no shuffling)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    print(f"Training set: {len(X_train)} samples")
    print(f"Testing set: {len(X_test)} samples")
    print(f"Positive samples in train: {y_train.sum()} ({y_train.sum()/len(y_train)*100:.1f}%)")
    
    # 5. Train Random Forest
    print("Training Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=50,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    
    # 6. Evaluate
    y_pred = model.predict(X_test)
    print("\n--- Model Evaluation ---")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(classification_report(y_test, y_pred))
    
    # 7. Save Model
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        
    joblib.dump(model, MODEL_PATH)
    
    # Also save the feature columns so the inference engine knows what to pass
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, "feature_cols.pkl"))
    print(f"Model saved to {MODEL_PATH}")

if __name__ == "__main__":
    train_model("BINANCE:BTC/USDT")
