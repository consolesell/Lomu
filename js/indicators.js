/**
 * IndicatorManager - Manages technical indicators for trading
 * @class
 */
export class IndicatorManager {
    constructor(config = {}) {
        // Default configuration for indicator parameters
        this.config = {
            rsiPeriod: config.rsiPeriod || 14,
            maPeriod: config.maPeriod || 20,
            bollingerPeriod: config.bollingerPeriod || 20,
            bollingerMultiplier: config.bollingerMultiplier || 2,
            macdFast: config.macdFast || 12,
            macdSlow: config.macdSlow || 26,
            macdSignal: config.macdSignal || 9,
            stochasticPeriod: config.stochasticPeriod || 14,
            stochasticSmooth: config.stochasticSmooth || 3,
            adxPeriod: config.adxPeriod || 14,
            volatilityPeriod: config.volatilityPeriod || 20,
            sentimentPeriod: config.sentimentPeriod || 10,
            atrPeriod: config.atrPeriod || 14,
            cciPeriod: config.cciPeriod || 20,
            vwapPeriod: config.vwapPeriod || 20,
            correlationLength: config.correlationLength || 50,
            minCandles: config.minCandles || 20,
            debug: config.debug || false
        };

        // Initialize indicators
        this.indicators = {
            rsi: 0,
            movingAverage: 0,
            bollingerBands: { upper: 0, middle: 0, lower: 0 },
            macd: { line: 0, signal: 0, histogram: 0 },
            stochastic: { k: 0, d: 0 },
            adx: 0,
            obv: 0,
            sentiment: 0,
            volatility: 0,
            atr: 0,
            cci: 0,
            vwap: 0
        };

        // Cache for intermediate calculations
        this.cache = {
            ema: new Map(), // Cache for EMA calculations
            prices: new Map() // Cache for recent prices per symbol
        };

        this.correlations = new Map();
        this.log = this.config.debug ? console.log.bind(console) : () => {};
    }

    /**
     * Update indicators based on candle data
     * @param {Array<Object>} candles - Array of candle objects
     */
    updateIndicators(candles) {
        if (!candles || !Array.isArray(candles) || candles.length < this.config.minCandles) {
            this.log(`Insufficient candle data for indicators: ${candles?.length || 0} candles`, 'warning');
            this.resetIndicators();
            return;
        }

        try {
            this.indicators.rsi = this.calculateRSI(candles);
            this.indicators.movingAverage = this.calculateMA(candles);
            this.indicators.bollingerBands = this.calculateBollingerBands(candles);
            this.indicators.macd = this.calculateMACD(candles);
            this.indicators.stochastic = this.calculateStochastic(candles);
            this.indicators.adx = this.calculateADX(candles);
            this.indicators.obv = this.calculateOBV(candles);
            this.indicators.sentiment = this.calculateSentiment(candles);
            this.indicators.volatility = this.calculateVolatility(candles);
            this.indicators.atr = this.calculateATR(candles);
            this.indicators.cci = this.calculateCCI(candles);
            this.indicators.vwap = this.calculateVWAP(candles);

            this.log('Indicators updated successfully', 'debug');
        } catch (error) {
            this.log(`Error updating indicators: ${error.message}`, 'error');
            this.resetIndicators();
        }
    }

    /**
     * Reset indicators to default values
     */
    resetIndicators() {
        this.indicators = {
            rsi: 0,
            movingAverage: 0,
            bollingerBands: { upper: 0, middle: 0, lower: 0 },
            macd: { line: 0, signal: 0, histogram: 0 },
            stochastic: { k: 0, d: 0 },
            adx: 0,
            obv: 0,
            sentiment: 0,
            volatility: 0,
            atr: 0,
            cci: 0,
            vwap: 0
        };
        this.cache.ema.clear();
        this.log('Indicators reset to default values', 'info');
    }

    /**
     * Calculate RSI
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} RSI value
     */
    calculateRSI(candles) {
        const period = this.config.rsiPeriod;
        if (candles.length < period + 1) {
            this.log(`Insufficient candles for RSI: ${candles.length}/${period + 1}`, 'warning');
            return 0;
        }

        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = candles[candles.length - i].close - candles[candles.length - i - 1].close;
            if (diff > 0) gains += diff;
            else losses -= diff;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / (avgLoss || 1); // Avoid division by zero
        const rsi = 100 - (100 / (1 + rs));
        return isNaN(rsi) ? 0 : parseFloat(rsi.toFixed(2));
    }

    /**
     * Calculate Moving Average
     * @param {Array<Object>} candles - Array of candle objects
     * @param {number} [period] - MA period (optional override)
     * @returns {number} MA value
     */
    calculateMA(candles, period = this.config.maPeriod) {
        if (candles.length < period) {
            this.log(`Insufficient candles for MA: ${candles.length}/${period}`, 'warning');
            return 0;
        }
        const sum = candles.slice(-period).reduce((sum, candle) => sum + candle.close, 0);
        return parseFloat((sum / period).toFixed(5));
    }

    /**
     * Calculate Bollinger Bands
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {Object} Bollinger Bands {upper, middle, lower}
     */
    calculateBollingerBands(candles) {
        const period = this.config.bollingerPeriod;
        const multiplier = this.config.bollingerMultiplier;
        if (candles.length < period) {
            this.log(`Insufficient candles for Bollinger Bands: ${candles.length}/${period}`, 'warning');
            return { upper: 0, middle: 0, lower: 0 };
        }

        const middle = this.calculateMA(candles, period);
        const prices = candles.slice(-period).map(c => c.close);
        const mean = prices.reduce((sum, price) => sum + price, 0) / period;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return {
            upper: parseFloat((middle + stdDev * multiplier).toFixed(5)),
            middle: parseFloat(middle.toFixed(5)),
            lower: parseFloat((middle - stdDev * multiplier).toFixed(5))
        };
    }

    /**
     * Calculate MACD
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {Object} MACD {line, signal, histogram}
     */
    calculateMACD(candles) {
        const { macdFast, macdSlow, macdSignal } = this.config;
        if (candles.length < macdSlow + macdSignal) {
            this.log(`Insufficient candles for MACD: ${candles.length}/${macdSlow + macdSignal}`, 'warning');
            return { line: 0, signal: 0, histogram: 0 };
        }

        const fastEMA = this.calculateEMA(candles, macdFast);
        const slowEMA = this.calculateEMA(candles, macdSlow);
        const line = fastEMA - slowEMA;

        // Cache signal line calculations
        const cacheKey = `macd_signal_${candles.length}_${macdSignal}`;
        if (!this.cache.ema.has(cacheKey)) {
            const signalPrices = [];
            for (let i = 0; i < macdSignal; i++) {
                const slice = candles.slice(-(macdSignal - i + macdSlow), -(macdSignal - i));
                if (slice.length >= macdSlow) {
                    signalPrices.push(this.calculateEMA(slice, macdFast) - this.calculateEMA(slice, macdSlow));
                }
            }
            const signalLine = signalPrices.length ? signalPrices.reduce((sum, val) => sum + val, 0) / signalPrices.length : 0;
            this.cache.ema.set(cacheKey, signalLine);
        }

        const signalLine = this.cache.ema.get(cacheKey) || 0;
        return {
            line: parseFloat(line.toFixed(5)),
            signal: parseFloat(signalLine.toFixed(5)),
            histogram: parseFloat((line - signalLine).toFixed(5))
        };
    }

    /**
     * Calculate EMA
     * @param {Array<Object>} candles - Array of candle objects
     * @param {number} period - EMA period
     * @returns {number} EMA value
     */
    calculateEMA(candles, period) {
        if (candles.length < period) {
            this.log(`Insufficient candles for EMA: ${candles.length}/${period}`, 'warning');
            return 0;
        }

        const cacheKey = `ema_${period}_${candles.length}`;
        if (this.cache.ema.has(cacheKey)) {
            return this.cache.ema.get(cacheKey);
        }

        const k = 2 / (period + 1);
        let ema = candles[candles.length - period].close;
        for (let i = candles.length - period + 1; i < candles.length; i++) {
            ema = candles[i].close * k + ema * (1 - k);
        }
        const result = parseFloat(ema.toFixed(5));
        this.cache.ema.set(cacheKey, result);
        return result;
    }

    /**
     * Calculate Stochastic Oscillator
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {Object} Stochastic {k, d}
     */
    calculateStochastic(candles) {
        const { stochasticPeriod, stochasticSmooth } = this.config;
        if (candles.length < stochasticPeriod + stochasticSmooth) {
            this.log(`Insufficient candles for Stochastic: ${candles.length}/${stochasticPeriod + stochasticSmooth}`, 'warning');
            return { k: 0, d: 0 };
        }

        const recent = candles.slice(-stochasticPeriod);
        const highest = Math.max(...recent.map(c => c.high));
        const lowest = Math.min(...recent.map(c => c.low));
        const k = ((candles[candles.length - 1].close - lowest) / (highest - lowest || 1)) * 100;

        const kValues = [];
        for (let i = 0; i < stochasticSmooth; i++) {
            const slice = candles.slice(-(stochasticPeriod + i), -(i || 1));
            if (slice.length >= stochasticPeriod) {
                const high = Math.max(...slice.map(c => c.high));
                const low = Math.min(...slice.map(c => c.low));
                kValues.push(((candles[candles.length - 1 - i].close - low) / (high - low || 1)) * 100);
            }
        }
        const d = kValues.length ? kValues.reduce((sum, val) => sum + val, 0) / kValues.length : 0;

        return {
            k: parseFloat(k.toFixed(2)),
            d: parseFloat(d.toFixed(2))
        };
    }

    /**
     * Calculate ADX
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} ADX value
     */
    calculateADX(candles) {
        const period = this.config.adxPeriod;
        if (candles.length < period + 1) {
            this.log(`Insufficient candles for ADX: ${candles.length}/${period + 1}`, 'warning');
            return 0;
        }

        let plusDM = 0, minusDM = 0, trSum = 0;
        for (let i = 1; i <= period; i++) {
            const curr = candles[candles.length - i];
            const prev = candles[candles.length - i - 1];
            const upMove = curr.high - prev.high;
            const downMove = prev.low - curr.low;
            plusDM += upMove > downMove && upMove > 0 ? upMove : 0;
            minusDM += downMove > upMove && downMove > 0 ? downMove : 0;
            trSum += Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close));
        }

        const plusDI = (plusDM / (trSum || 1)) * 100;
        const minusDI = (minusDM / (trSum || 1)) * 100;
        const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1) * 100;
        return parseFloat(dx.toFixed(2));
    }

    /**
     * Calculate OBV
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} OBV value
     */
    calculateOBV(candles) {
        if (candles.length < 2) {
            this.log(`Insufficient candles for OBV: ${candles.length}/2`, 'warning');
            return 0;
        }

        let obv = 0;
        for (let i = 1; i < candles.length; i++) {
            const curr = candles[i];
            const prev = candles[i - 1];
            const volume = curr.volume || 1; // Fallback volume
            if (curr.close > prev.close) obv += volume;
            else if (curr.close < prev.close) obv -= volume;
        }
        return parseFloat(obv.toFixed(2));
    }

    /**
     * Calculate market sentiment
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} Sentiment score
     */
    calculateSentiment(candles) {
        const period = this.config.sentimentPeriod;
        if (candles.length < period) {
            this.log(`Insufficient candles for Sentiment: ${candles.length}/${period}`, 'warning');
            return 0;
        }

        const recent = candles.slice(-period);
        const bullish = recent.filter(c => c.close > c.open).length;
        const sentiment = (bullish / period - 0.5) * 100;
        return parseFloat(sentiment.toFixed(2));
    }

    /**
     * Calculate volatility
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} Volatility percentage
     */
    calculateVolatility(candles) {
        const period = this.config.volatilityPeriod;
        if (candles.length < period) {
            this.log(`Insufficient candles for Volatility: ${candles.length}/${period}`, 'warning');
            return 0;
        }

        const prices = candles.slice(-period).map(c => c.close);
        const mean = prices.reduce((sum, p) => sum + p, 0) / period;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
        const volatility = Math.sqrt(variance) / mean * 100;
        return parseFloat(volatility.toFixed(2));
    }

    /**
     * Calculate Average True Range (ATR)
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} ATR value
     */
    calculateATR(candles) {
        const period = this.config.atrPeriod;
        if (candles.length < period + 1) {
            this.log(`Insufficient candles for ATR: ${candles.length}/${period + 1}`, 'warning');
            return 0;
        }

        const trValues = [];
        for (let i = 1; i <= period; i++) {
            const curr = candles[candles.length - i];
            const prev = candles[candles.length - i - 1];
            const tr = Math.max(
                curr.high - curr.low,
                Math.abs(curr.high - prev.close),
                Math.abs(curr.low - prev.close)
            );
            trValues.push(tr);
        }
        const atr = trValues.reduce((sum, val) => sum + val, 0) / period;
        return parseFloat(atr.toFixed(5));
    }

    /**
     * Calculate Commodity Channel Index (CCI)
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} CCI value
     */
    calculateCCI(candles) {
        const period = this.config.cciPeriod;
        if (candles.length < period) {
            this.log(`Insufficient candles for CCI: ${candles.length}/${period}`, 'warning');
            return 0;
        }

        const typicalPrices = candles.slice(-period).map(c => (c.high + c.low + c.close) / 3);
        const mean = typicalPrices.reduce((sum, p) => sum + p, 0) / period;
        const meanDeviation = typicalPrices.reduce((sum, p) => sum + Math.abs(p - mean), 0) / period;
        const latestTypicalPrice = (candles[candles.length - 1].high + candles[candles.length - 1].low + candles[candles.length - 1].close) / 3;
        const cci = (latestTypicalPrice - mean) / (0.015 * (meanDeviation || 1));
        return parseFloat(cci.toFixed(2));
    }

    /**
     * Calculate Volume-Weighted Average Price (VWAP)
     * @param {Array<Object>} candles - Array of candle objects
     * @returns {number} VWAP value
     */
    calculateVWAP(candles) {
        const period = this.config.vwapPeriod;
        if (candles.length < period) {
            this.log(`Insufficient candles for VWAP: ${candles.length}/${period}`, 'warning');
            return 0;
        }

        let totalPriceVolume = 0, totalVolume = 0;
        for (const candle of candles.slice(-period)) {
            const typicalPrice = (candle.high + candle.low + candle.close) / 3;
            const volume = candle.volume || 1; // Fallback volume
            totalPriceVolume += typicalPrice * volume;
            totalVolume += volume;
        }
        const vwap = totalPriceVolume / (totalVolume || 1);
        return parseFloat(vwap.toFixed(5));
    }

    /**
     * Calculate Pearson correlation between two symbols
     * @param {Array<Object>} candles1 - Candles for first symbol
     * @param {Array<Object>} candles2 - Candles for second symbol
     * @returns {number} Correlation coefficient
     */
    calculateCorrelation(candles1, candles2) {
        const n = Math.min(candles1.length, candles2.length, this.config.correlationLength);
        if (n < this.config.minCandles) {
            this.log(`Insufficient candles for correlation: ${n}/${this.config.minCandles}`, 'warning');
            return 0;
        }

        const x = candles1.slice(-n).map(c => c.close);
        const y = candles2.slice(-n).map(c => c.close);

        const meanX = x.reduce((sum, val) => sum + val, 0) / n;
        const meanY = y.reduce((sum, val) => sum + val, 0) / n;

        let cov = 0, stdX = 0, stdY = 0;
        for (let i = 0; i < n; i++) {
            const dx = x[i] - meanX;
            const dy = y[i] - meanY;
            cov += dx * dy;
            stdX += dx * dx;
            stdY += dy * dy;
        }

        const correlation = cov / (Math.sqrt(stdX) * Math.sqrt(stdY) || 1);
        return parseFloat(correlation.toFixed(2));
    }

    /**
     * Update correlations for all symbol pairs
     * @param {Map<string, Array<Object>>} candlesMap - Map of symbol to candles
     */
    updateCorrelations(candlesMap) {
        this.correlations.clear();
        const symbols = Array.from(candlesMap.keys());
        for (let i = 0; i < symbols.length; i++) {
            for (let j = i + 1; j < symbols.length; j++) {
                const pair = `${symbols[i]}-${symbols[j]}`;
                const correlation = this.calculateCorrelation(
                    candlesMap.get(symbols[i]),
                    candlesMap.get(symbols[j])
                );
                this.correlations.set(pair, correlation);
                this.log(`Correlation calculated for ${pair}: ${correlation}`, 'debug');
            }
        }
    }

    /**
     * Get current indicators
     * @returns {Object} Current indicator values
     */
    getIndicators() {
        return { ...this.indicators };
    }

    /**
     * Get correlations
     * @returns {Map<string, number>} Symbol pair correlations
     */
    getCorrelations() {
        return new Map(this.correlations);
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.log = this.config.debug ? console.log.bind(console) : () => {};
        this.log('Configuration updated', 'info');
    }
}
