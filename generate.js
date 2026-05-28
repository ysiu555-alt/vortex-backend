const { run } = require('./database');

/**
 * Генератор случайных ключей формата KLIANG-XXXX-XXXX
 */
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `KLIANG-${segment()}-${segment()}`;
}

/**
 * Функция для массового создания ключей
 * @param {string} planType - Тип плана (TRIAL_3DAYS, WEEK_2, MONTH_1, LIFETIME)
 * @param {number} count - Количество ключей
 */
async function createKeys(planType, count = 1) {
    console.log(`Генерация ${count} ключей для плана: ${planType}...`);
    
    let createdCount = 0;
    for (let i = 0; i < count; i++) {
        const code = generateKey();
        try {
            await run(
                'INSERT INTO funpay_keys (coupon_code, plan_type, is_used) VALUES (?, ?, 0)',
                [code, planType]
            );
            console.log(`[+] Создан: ${code}`);
            createdCount++;
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                // Если дубликат — пробуем еще раз
                i--;
                continue;
            }
            console.error(`[-] Ошибка при создании ключа ${code}:`, err.message);
        }
    }
    console.log(`Готово! Успешно создано ключей: ${createdCount}`);
    process.exit(0);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Использование: node generate.js <PLAN_TYPE> <COUNT>');
    console.log('Примеры планов: TRIAL_3DAYS, WEEK_2, MONTH_1, LIFETIME');
} else {
    const plan = args[0];
    const count = parseInt(args[1], 10);
    if (isNaN(count)) {
        console.log('Ошибка: Количество должно быть числом');
    } else {
        createKeys(plan, count);
    }
}
