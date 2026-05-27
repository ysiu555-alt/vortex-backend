const { calculateNewExpiry } = require('./src/utils/subscription');

function testSubscription() {
    console.log('Testing Subscription Logic...');
    
    // Тест 1: Новая подписка на неделю
    const res1 = calculateNewExpiry(null, 'WEEK_2');
    console.log('Test 1 (New WEEK_2):', res1);

    // Тест 2: Продление активной подписки
    const current = new Date();
    current.setHours(current.getHours() + 1); // +1 час от текущего
    const res2 = calculateNewExpiry(current.toISOString(), 'WEEK_2');
    console.log('Test 2 (Extend active):', res2);

    // Тест 3: Lifetime
    const res3 = calculateNewExpiry(current.toISOString(), 'LIFETIME');
    console.log('Test 3 (LIFETIME):', res3);

    // Тест 4: Продление просроченной подписки
    const expired = new Date();
    expired.setHours(expired.getHours() - 1); // -1 час
    const res4 = calculateNewExpiry(expired.toISOString(), 'MONTH_1');
    console.log('Test 4 (Expired MONTH_1):', res4);
}

testSubscription();
