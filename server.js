const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt'); // Per l'hashing delle password

// Redis
const Redis = require('ioredis');
const connectRedis = require('connect-redis');

const app = express();
const port = 3000;

// Configura Redis client con Upstash (metti qui il tuo URL/token Redis)
const redisClient = new Redis('redis://default:AjHCAAIgcDFVIThWMg84X_B1fGovJjhIVDV7Ogg9AhQ7cvL2g9wsVg@dominant-pelican-12738.upstash.io:6379');

// Inizializza RedisStore per express-session
const RedisStore = connectRedis(session);

// Configurazione di express-session con Redis come store
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: 'la_tua_chiave_segreta_molto_lunga_e_casuale_per_il_portale_studenti', // Cambia con una tua segreta
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // Sessione valida 24h
}));

// Middleware per parsare il corpo JSON
app.use(express.json());
// Middleware per servire file statici
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
                if (err) console.error('Errore nella creazione tabella users:', err.message);
                else {
                    db.get(`SELECT * FROM users WHERE username = 'admin'`, [], (err, row) => {
                        if (err) console.error('Errore nel controllo admin:', err.message);
                        else if (!row) {
                            bcrypt.hash('adminpassword', 10, (err, hash) => {
                                if (err) console.error('Errore hashing admin password:', err.message);
                                else {
                                    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
                                    ['admin', hash, 'admin']);
                                }
                            });
                        }
                    });
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                registration_number TEXT UNIQUE NOT NULL,
                birth_date TEXT,
                address TEXT,
                phone TEXT,
                email TEXT UNIQUE NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS student_courses (
                student_id INTEGER,
                course_id INTEGER,
                PRIMARY KEY (student_id, course_id),
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            )`);
        });
    }
});

// Funzione middleware per autenticazione e ruolo
function authenticateRole(role) {
    return (req, res, next) => {
        if (!req.session.userId) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({ error: 'Non autenticato.' });
            }
            return res.redirect('/');
        }

        db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err) return res.status(500).json({ error: 'Errore server.' });
            if (!user || user.role !== role) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
                    return res.status(403).json({ error: 'Accesso negato.' });
                }
                if (req.session.userRole === 'student') return res.redirect('/student-dashboard');
                return res.redirect('/');
            }
            next();
        });
    };
}

// ROTTE STATICHE
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-dashboard', authenticateRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/student-dashboard', authenticateRole('student'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

// API di registrazione
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Tutti i campi obbligatori.' });
    }
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Errore server.' });
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, 'student')`,
            [username, hash], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Username già in uso.' });
                    }
                    return res.status(500).json({ error: 'Errore registrazione.' });
                }
                const userId = this.lastID;
                db.run(`INSERT INTO students (user_id, registration_number, email) VALUES (?, ?, ?)`,
                    [userId, `REG-${Date.now()}`, email], (err) => {
                        if (err) return res.status(500).json({ error: 'Errore registrazione studente.' });
                        res.status(201).json({ message: 'Registrazione avvenuta.' });
                    });
            });
    });
});

// API di login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id, username, password, role FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Errore server.' });
        if (!user) return res.status(401).json({ error: 'Credenziali non valide.' });
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) return res.status(500).json({ error: 'Errore server.' });
            if (!result) return res.status(401).json({ error: 'Credenziali non valide.' });

            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.userRole = user.role;
            res.json({ message: 'Login riuscito.', role: user.role });
        });
    });
});

// API logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Errore logout.' });
        res.json({ message: 'Logout effettuato.' });
    });
});

// [QUI CI VAI AD AGGIUNGERE TUTTE LE ALTRE ROTTE API CHE AVEVI, STUDENTI, CORSI, ISCRIZIONI...]
// Per brevità non le riscrivo qui ma le puoi riutilizzare dal tuo codice precedente, senza cambiare nulla.

// Avvio server
app.listen(port, () => {
    console.log(`Server in ascolto su http://localhost:${port}`);
    console.log(`Admin: http://localhost:${port}/admin-dashboard (username: admin, password: adminpassword)`);
    console.log(`Login page: http://localhost:${port}/`);
});
