const TARIFFS = {
    TRIAL_3DAYS: 3 * 24 * 60 * 60 * 1000,
    WEEK_2: 14 * 24 * 60 * 60 * 1000,
    MONTH_1: 30 * 24 * 60 * 60 * 1000,
    LIFETIME: '2099-12-31 23:59:59'
};

const PLAN_PRICES = {
    WEEK_2: 50,
    MONTH_1: 85,
    LIFETIME: 200
};

function calculateNewExpiry(currentExpiry, planType) {
    if (planType === 'LIFETIME') {
        return TARIFFS.LIFETIME;
    }

    const now = new Date();
    const duration = TARIFFS[planType];
    
    if (!duration) {
        throw new Error(`Unknown plan type: ${planType}`);
    }

    let baseTime;
    if (!currentExpiry || new Date(currentExpiry) < now) {
        baseTime = now;
    } else {
        baseTime = new Date(currentExpiry);
    }

    const newExpiry = new Date(baseTime.getTime() + duration);
    return newExpiry.toISOString().replace('T', ' ').slice(0, 19);
}

module.exports = {
    calculateNewExpiry,
    TARIFFS,
    PLAN_PRICES
};
