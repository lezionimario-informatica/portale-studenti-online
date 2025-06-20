const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt'); // Per l'hashing delle password

const Redis = require('redis');
const connectRedis = require('connect-redis');

const RedisStore = connectRedis(session);

// Configura il client Redis con la tua URL Upstash
const redisClient = Redis.createClient({
  url: 'redis://default:********@dominant-pelican-12738.upstash.io:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Avvia la connessione Redis prima di iniziare Express
(async () => {
  await redisClient.connect();
  console.log('Connesso a Redis Upstash');
})();

const app = express();
const port = 3000;

// Configurazione di express-session con Redis come store
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'la_tua_chiave_segreta_molto_lunga_e_casuale_per_il_portale_studenti', // Cambia questa chiave con una forte e segreta!
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // Sessione valida 24 ore
}));

// Middleware per parsare il corpo delle richieste in formato JSON
app.use(express.json());
// Middleware per servire file statici dalla directory 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- INIZIALIZZAZIONE DATABASE ---

const dbPath = path.join(__dirname, 'database.sqlite');
console.log('Tentativo di connessione/creazione database al percorso:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Errore nell\'apertura/creazione del database:', err.message);
    process.exit(1);
  } else {
    console.log('Connesso al database SQLite.');
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'student'
      )`, (err) => {
        if (err) {
          console.error('Errore nella creazione tabella users:', err.message);
        } else {
          db.get(`SELECT * FROM users WHERE username = 'admin'`, [], (err, row) => {
            if (err) {
              console.error('Errore nel controllo utente admin:', err.message);
              return;
            }
            if (!row) {
              bcrypt.hash('adminpassword', 10, (err, hash) => {
                if (err) {
                  console.error('Errore nell\'hashing password admin:', err.message);
                  return;
                }
                db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
                  ['admin', hash, 'admin'], (err) => {
                    if (err) {
                      console.error('Errore nella creazione utente admin:', err.message);
                    } else {
                      console.log('Utente amministratore predefinito creato: username "admin", password "adminpassword"');
                    }
                  });
              });
            } else {
              console.log('Utente amministratore predefinito già esistente.');
            }
          });
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS courses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT
      )`, (err) => {
        if (err) {
          console.error('Errore nella creazione tabella courses:', err.message);
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          registration_number TEXT UNIQUE NOT NULL,
          birth_date TEXT,
          address TEXT,
          phone TEXT,
          email TEXT UNIQUE NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => {
        if (err) {
          console.error('Errore nella creazione tabella students:', err.message);
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS student_courses (
          student_id INTEGER,
          course_id INTEGER,
          PRIMARY KEY (student_id, course_id),
          FOREIGN KEY (student_id) REFERENCES students(id),
          FOREIGN KEY (course_id) REFERENCES courses(id)
      )`, (err) => {
        if (err) {
          console.error('Errore nella creazione tabella student_courses:', err.message);
        }
      });
    });
  }
});

// Middleware per proteggere le route in base al ruolo
function authenticateRole(role) {
  return (req, res, next) => {
    if (!req.session.userId) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Non autenticato. Effettua il login.' });
      }
      return res.redirect('/');
    }
    db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
      if (err) {
        console.error('Errore nel recupero ruolo utente:', err.message);
        return res.status(500).json({ error: 'Errore interno del server.' });
      }
      if (!user || user.role !== role) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
          return res.status(403).json({ error: 'Accesso negato. Ruolo non autorizzato.' });
        }
        if (req.session.userRole === 'student') {
          return res.redirect('/student-dashboard');
        }
        return res.redirect('/');
      }
      next();
    });
  };
}

// Rotte statiche
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-dashboard', authenticateRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/student-dashboard', authenticateRole('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

// API di autenticazione e gestione utenti/corsi come nel tuo codice originale...

// (tutte le rotte API le lasci così come le hai scritte in precedenza)

// Avvio server
app.listen(port, () => {
  console.log(`Server del portale in ascolto su http://localhost:${port}`);
  console.log(`Admin: http://localhost:${port}/admin-dashboard (admin/adminpassword)`);
  console.log(`Login page: http://localhost:${port}`);
});
