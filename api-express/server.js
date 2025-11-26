const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bienvenue dans mon API Express !');
});

const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// Lancer le serveur
app.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});
