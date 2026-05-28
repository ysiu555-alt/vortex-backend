const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'vortex.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Активация поддержки внешних ключей
        db.run('PRAGMA foreign_keys = ON;');

        // Таблица пользователей и их подписок
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            hwid TEXT DEFAULT NULL,
            reg_ip TEXT NOT NULL,
            subscription_type TEXT NOT NULL DEFAULT 'NONE',
            expires_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT NULL
        )`);

        // Таблица автоматических инвойсов Crypto Bot
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            invoice_id TEXT UNIQUE NOT NULL,
            amount REAL NOT NULL,
            plan_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Таблица купонов/ключей для ручной выдачи и FunPay
        db.run(`CREATE TABLE IF NOT EXISTS funpay_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coupon_code TEXT UNIQUE NOT NULL,
            plan_type TEXT NOT NULL,
            is_used INTEGER NOT NULL DEFAULT 0,
            used_by_user_id INTEGER DEFAULT NULL,
            activated_at TIMESTAMP DEFAULT NULL,
            FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Добавление новых колонок для ЭТАПА 2 (HWID, MAC, IP)
        // Используем отдельные запросы, чтобы не прервать инициализацию, если колонки уже есть
        db.run('ALTER TABLE users ADD COLUMN mac_address TEXT DEFAULT NULL;', (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding mac_address:', err.message);
            }
        });
        db.run('ALTER TABLE users ADD COLUMN ip_address TEXT DEFAULT NULL;', (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding ip_address:', err.message);
            }
        });
    });
}

// Промисификация методов для удобства использования
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = {
    db,
    run,
    get,
    all
};
