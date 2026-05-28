const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
});

const User = sequelize.define('User', {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    hwid: { type: DataTypes.STRING, allowNull: true },
    reg_ip: { type: DataTypes.STRING, allowNull: false },
    subscription_type: { type: DataTypes.STRING, defaultValue: 'NONE' },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    mac_address: { type: DataTypes.STRING, allowNull: true },
    ip_address: { type: DataTypes.STRING, allowNull: true },
    last_login: { type: DataTypes.DATE, allowNull: true }
});

const Order = sequelize.define('Order', {
    invoice_id: { type: DataTypes.STRING, unique: true, allowNull: false },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    plan_type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'PENDING' }
});

const FunPayKey = sequelize.define('FunPayKey', {
    coupon_code: { type: DataTypes.STRING, unique: true, allowNull: false },
    plan_type: { type: DataTypes.STRING, allowNull: false },
    is_used: { type: DataTypes.BOOLEAN, defaultValue: false },
    activated_at: { type: DataTypes.DATE, allowNull: true }
});

// Связи
User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(FunPayKey, { foreignKey: 'used_by_user_id' });
FunPayKey.belongsTo(User, { foreignKey: 'used_by_user_id' });

const initDb = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL connected.');
        await sequelize.sync(); // sync() automatically creates tables
        console.log('Database synced.');
    } catch (err) {
        console.error('Database connection error:', err);
    }
};

module.exports = { sequelize, User, Order, FunPayKey, initDb };
