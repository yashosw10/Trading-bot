#include <iostream>
#include <vector>
#include <cmath>
#include <string>
#include <sstream>
#include <iomanip>

using namespace std;

struct QuantSignal {
    string signal;
    double confidence;
    double z_score;
    double volatility;
    double kelly_fraction;
};

QuantSignal generate_signal(const vector<double>& prices, int window_size) {
    QuantSignal result = {"HOLD", 0.0, 0.0, 0.0, 0.0};
    int length = prices.size();
    
    if (length < window_size) {
        return result;
    }

    double sum = 0.0;
    double sum_sq = 0.0;

    // Calculate rolling stats for the most recent window
    for (int i = length - window_size; i < length; ++i) {
        sum += prices[i];
        sum_sq += prices[i] * prices[i];
    }

    double mean = sum / window_size;
    double variance = (sum_sq / window_size) - (mean * mean);
    double stddev = (variance > 1e-8) ? std::sqrt(variance) : 1e-8;
    
    double current_price = prices.back();
    double z_score = (current_price - mean) / stddev;
    double bb_width = (4 * stddev) / mean; // Bollinger Band Width for Volatility
    
    // Momentum / Rate of Change (last 3 periods)
    double momentum = 0.0;
    if (length >= 4) {
        momentum = (current_price - prices[length - 4]) / prices[length - 4];
    }

    result.z_score = z_score;
    result.volatility = bb_width;

    // --- MEAN REVERSION LOGIC ---
    
    // Mean Reversion Buy: Extremely oversold (Z < -2.5) but momentum stabilizing
    if (z_score <= -2.5 && momentum > -0.01) {
        result.signal = "BUY";
        result.confidence = min(0.95, std::abs(z_score) / 4.0); 
    }
    // Mean Reversion Sell: Extremely overbought (Z > 2.5)
    else if (z_score >= 2.5 && momentum < 0.01) {
        result.signal = "SELL";
        result.confidence = min(0.95, z_score / 4.0);
    }
    // Strong Buy: Oversold (Z < -1.5) in low volatility (safer entry)
    else if (z_score <= -1.5 && bb_width < 0.02) {
        result.signal = "BUY";
        result.confidence = 0.65;
    }
    // Moderate Sell: Overbought (Z > 1.5) in low volatility
    else if (z_score >= 1.5 && bb_width < 0.02) {
        result.signal = "SELL";
        result.confidence = 0.65;
    }

    // --- KELLY CRITERION POSITION SIZING ---
    if (result.signal != "HOLD" && result.confidence > 0.5) {
        // f* = W - ((1 - W) / R)
        // Assume Reward/Risk ratio (R) is ~1.0 for standard mean reversion
        double W = result.confidence; 
        double kelly = W - ((1.0 - W) / 1.0);
        
        // We use a "Half-Kelly" fraction to reduce volatility and risk of ruin
        double half_kelly = kelly / 2.0;
        
        // Cap the maximum portfolio risk at 8% per trade for aggressive growth
        if (half_kelly < 0.01) half_kelly = 0.01; // Minimum 1%
        if (half_kelly > 0.08) half_kelly = 0.08; // Maximum 8%
        
        // If it's a high volatility environment, shrink the position further
        if (bb_width > 0.03) {
            half_kelly *= 0.5; // Shrink by 50% in choppy markets
        }
        
        result.kelly_fraction = half_kelly;
    }

    return result;
}

int main() {
    // Optimize standard I/O operations for microservice speed
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string line;
    while (getline(cin, line)) {
        if (line == "EXIT") break;

        vector<double> prices;
        stringstream ss(line);
        double price;
        while (ss >> price) {
            prices.push_back(price);
        }

        QuantSignal qs = generate_signal(prices, 20);

        // IPC Output Format: SIGNAL CONFIDENCE Z_SCORE KELLY_FRACTION
        cout << qs.signal << " " 
             << fixed << setprecision(4) << qs.confidence << " " 
             << qs.z_score << " " 
             << qs.kelly_fraction << "\n";
        cout.flush(); 
    }
    return 0;
}
