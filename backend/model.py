import yfinance as yf
import pandas as pd
import numpy as np
from statsmodels.tsa.ar_model import AutoReg


#Creating a dataset based on ticker and period
def create_dataset(ticker, period):
    try:
        data = yf.download(ticker, period=period, auto_adjust=False)
    except yf.shared.YFPricesMissingError as e:
        print(f"[Warning] Could not download data for {ticker}: {e}")
        return pd.DataFrame()
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = [col[0] for col in data.columns]
    df = data[['Close']].copy()
    df.index = pd.to_datetime(df.index)
    return df

#Testing model on todays value - removing last row and predicting it to compare
def try_today(df):
    today = pd.Timestamp.today().normalize()
    new_df = estimate_new(df, today - pd.Timedelta(days=1))
    
    return new_df.tail(1)

def estimate_week(df):
    today = pd.Timestamp.today().normalize()
    new_df = estimate_new(df, today - pd.Timedelta(days=1), numdays=7)

    return new_df.tail(7)

#Estimating next day(s) value based on previous values
def estimate_new(df, startdays, numdays=1):
    df = df.copy()
    df.index = pd.to_datetime(df.index)
    df["Predicted"] = np.nan
    df_subset = df.loc[:startdays + pd.Timedelta(days=1)]

    for _ in range(numdays):
        values = df_subset["Predicted"].fillna(df_subset["Close"]).dropna().values

        lags = 1
        model = AutoReg(values, lags=lags)
        model_fit = model.fit()

        next_day_pred = model_fit.predict(start=len(values), end=len(values))[0]
        next_date = startdays + pd.Timedelta(days=1)

        if next_date in df.index:
            df.loc[next_date, "Predicted"] = next_day_pred
        else:
            df.loc[next_date] = [np.nan, next_day_pred]

        df_subset = df.loc[df.index <= next_date]
        startdays = startdays + pd.Timedelta(days=1)
    return df

#Evaluating the model using Mean Absolute Error (MAE)
def good_model(df_actual, df_predicted):
    mae = (df_actual['Close'] - df_predicted['Close']).abs().mean().item()
    avg_daily_change = df_actual['Close'].diff().abs().mean().item()
    print("Mean Absolute Error (MAE): ", mae)
    print("Average Daily Change: ", avg_daily_change)
    if mae < avg_daily_change:
        return True
    return False

if __name__ == "__main__":
    #Variables
    tickers = ['GOOGL','AAPL', 'MSFT', 'AMZN']
    period = '5y'

    estimate_week(create_dataset('AAPL', '5y'))
    try_today(create_dataset('AAPL', '5y'))
