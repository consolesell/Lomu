/**
 * CandleManager - Manages candlestick data and pattern detection
 * @class
 */
export class CandleManager {
    constructor({
        timeframe = 60,
        maxCandles = 100,
        dojiThreshold = 0.1,
        shadowMultiplier = 2,
        smallShadowMultiplier = 0.5,
        longBodyThreshold = 0.6,
        enableTrendCheck = true
    } = {}) {
        this.timeframe = timeframe * 1000; // Convert to milliseconds
        this.maxCandles = maxCandles;
        this.dojiThreshold = dojiThreshold;
        this.shadowMultiplier = shadowMultiplier;
        this.smallShadowMultiplier = smallShadowMultiplier;
        this.longBodyThreshold = longBodyThreshold;
        this.enableTrendCheck = enableTrendCheck;
        this.candles = new Map(); // Map<symbol, Array<Candle>>
    }

    /**
     * Initialize candles for a symbol
     * @param {string} symbol - Market symbol
     */
    initializeSymbol(symbol) {
        if (!this.candles.has(symbol)) {
            this.candles.set(symbol, []);
        }
    }

    /**
     * Set candle timeframe
     * @param {number} timeframe - Timeframe in seconds
     */
    setTimeframe(timeframe) {
        this.timeframe = timeframe * 1000;
    }

    /**
     * Add a tick to the candle data
     * @param {string} symbol - Market symbol
     * @param {Object} tick - Tick data { price, time (Date), volume }
     */
    addTick(symbol, tick) {
        if (!tick || typeof tick.price !== 'number' || !(tick.time instanceof Date)) {
            throw new Error('Invalid tick data');
        }
        if (!this.candles.has(symbol)) {
            this.initializeSymbol(symbol);
        }

        const candles = this.candles.get(symbol);
        const timestamp = Math.floor(tick.time.getTime() / this.timeframe) * this.timeframe;
        let currentCandle = candles.find(c => c.timestamp === timestamp);

        if (!currentCandle) {
            currentCandle = {
                symbol,
                timestamp,
                open: tick.price,
                high: tick.price,
                low: tick.price,
                close: tick.price,
                volume: tick.volume || 0
            };
            candles.push(currentCandle);
            // Sort by timestamp if added out-of-order
            candles.sort((a, b) => a.timestamp - b.timestamp);
        } else {
            currentCandle.high = Math.max(currentCandle.high, tick.price);
            currentCandle.low = Math.min(currentCandle.low, tick.price);
            currentCandle.close = tick.price;
            currentCandle.volume += tick.volume || 0;
        }

        if (candles.length > this.maxCandles) {
            candles.shift();
        }
    }

    /**
     * Add historical tick data for backtesting
     * @param {string} symbol - Market symbol
     * @param {Object} tick - Historical tick data { price, timestamp (ms or string), volume }
     */
    addHistoricalTick(symbol, tick) {
        this.addTick(symbol, {
            price: tick.price,
            time: new Date(tick.timestamp),
            volume: tick.volume || 1
        });
    }

    /**
     * Add a full candle directly
     * @param {string} symbol - Market symbol
     * @param {Object} candle - Candle data { timestamp, open, high, low, close, volume }
     */
    addCandle(symbol, candle) {
        if (!this.candles.has(symbol)) {
            this.initializeSymbol(symbol);
        }
        const candles = this.candles.get(symbol);
        candles.push({ ...candle, symbol });
        candles.sort((a, b) => a.timestamp - b.timestamp);
        if (candles.length > this.maxCandles) {
            candles.shift();
        }
    }

    /**
     * Get candles for a symbol
     * @param {string} symbol - Market symbol
     * @returns {Array<Object>} Array of candle objects
     */
    getCandles(symbol) {
        return this.candles.get(symbol) || [];
    }

    /**
     * Check if prior trend matches reversal type (simple: average of last n closes)
     * @param {Array<Object>} candles - Candles array
     * @param {string} type - 'bullish' or 'bearish'
     * @returns {boolean}
     */
    checkTrend(candles, type) {
        if (candles.length < 5 || !this.enableTrendCheck) return true;
        const prevCloses = candles.slice(-5, -1).map(c => c.close);
        const avgPrev = prevCloses.reduce((sum, c) => sum + c, 0) / prevCloses.length;
        return (type === 'bullish' && candles[candles.length - 1].close > avgPrev) ||
               (type === 'bearish' && candles[candles.length - 1].close < avgPrev);
    }

    /**
     * Detect candlestick patterns
     * @param {string} symbol - Market symbol
     * @returns {Object|null} { name, type: 'bullish'|'bearish', confidence: 0-1 } or null
     */
    detectPattern(symbol) {
        const candles = this.candles.get(symbol);
        if (!candles || candles.length < 3) return null;

        const [prev2, prev, current] = candles.slice(-3);
        let confidence = 0.8; // Base, adjust based on matches

        // Helper calculations for current
        const body = Math.abs(current.open - current.close);
        const range = current.high - current.low;
        const upper = current.high - Math.max(current.open, current.close);
        const lower = Math.min(current.open, current.close) - current.low;
        const isBullishBody = current.close > current.open;
        const isBearishBody = current.close < current.open;

        // Bullish Engulfing
        if (prev.close < prev.open && isBullishBody &&
            current.close >= prev.open && current.open <= prev.close &&
            this.checkTrend(candles, 'bullish')) {
            if (body > Math.abs(prev.open - prev.close)) confidence += 0.1;
            return { name: 'BullishEngulfing', type: 'bullish', confidence };
        }

        // Bearish Engulfing
        if (prev.close > prev.open && isBearishBody &&
            current.close <= prev.open && current.open >= prev.close &&
            this.checkTrend(candles, 'bearish')) {
            if (body > Math.abs(prev.open - prev.close)) confidence += 0.1;
            return { name: 'BearishEngulfing', type: 'bearish', confidence };
        }

        // Doji
        if (body <= range * this.dojiThreshold) {
            // Subtype bonuses
            if (upper > lower * 2) confidence += 0.1; // Gravestone-like
            else if (lower > upper * 2) confidence += 0.1; // Dragonfly-like
            return { name: 'Doji', type: 'neutral', confidence };
        }

        // Hammer / Hanging Man (shape-based; context determines bullish/bearish)
        if (body > 0 && lower >= this.shadowMultiplier * body && upper <= this.smallShadowMultiplier * body) {
            const type = this.checkTrend(candles, 'bullish') ? 'bullish' : 'bearish';
            const name = type === 'bullish' ? 'Hammer' : 'HangingMan';
            return { name, type, confidence };
        }

        // Shooting Star / Inverted Hammer (shape-based)
        if (body > 0 && upper >= this.shadowMultiplier * body && lower <= this.smallShadowMultiplier * body) {
            const type = this.checkTrend(candles, 'bearish') ? 'bearish' : 'bullish';
            const name = type === 'bearish' ? 'ShootingStar' : 'InvertedHammer';
            return { name, type, confidence };
        }

        // Morning Star (3-candle bullish reversal)
        const prev2Body = Math.abs(prev2.open - prev2.close);
        const prev2Range = prev2.high - prev2.low;
        const prevBody = Math.abs(prev.open - prev.close);
        const prevRange = prev.high - prev.low;
        if (prev2.close < prev2.open && prev2Body >= prev2Range * this.longBodyThreshold && // Long bearish
            prevBody <= prevRange * (1 - this.longBodyThreshold) && // Small star
            isBullishBody && body >= range * this.longBodyThreshold && // Long bullish
            current.close > (prev2.open + prev2.close) / 2 && // Above midpoint
            this.checkTrend(candles, 'bullish')) {
            confidence += 0.1;
            return { name: 'MorningStar', type: 'bullish', confidence };
        }

        // Evening Star (3-candle bearish reversal)
        if (prev2.close > prev2.open && prev2Body >= prev2Range * this.longBodyThreshold && // Long bullish
            prevBody <= prevRange * (1 - this.longBodyThreshold) && // Small star
            isBearishBody && body >= range * this.longBodyThreshold && // Long bearish
            current.close < (prev2.open + prev2.close) / 2 && // Below midpoint
            this.checkTrend(candles, 'bearish')) {
            confidence += 0.1;
            return { name: 'EveningStar', type: 'bearish', confidence };
        }

        return null;
    }
}
