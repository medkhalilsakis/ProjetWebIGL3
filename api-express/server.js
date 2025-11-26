const express = require('express');
const app = express();
const db = require("./db");

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bienvenue dans mon API Express !');
});

app.get("/clients", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM utilisateurs");
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Erreur serveur" });
    }
});

// Lancer le serveur
app.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});
