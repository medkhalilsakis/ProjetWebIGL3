// db.js
const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "LivraXpress",
    password: "1234",
    port: 5432,              
});

// Test de connexion
pool.connect()
    .then(() => console.log("📌 PostgreSQL connecté avec succès"))
    .catch(err => console.error("❌ Erreur connexion PostgreSQL", err));

module.exports = pool;
