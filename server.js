const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt'); // Per l'hashing delle password

const app = express();
const port = 3000;

// Configurazione di express-session
app.use(session({
    secret: 'la_tua_chiave_segreta_molto_lunga_e_casuale_per_il_portale_studenti', // CAMBIA QUESTA CHIAVE SEGRETA!
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // Sessione valida per 24 ore
}));

// Middleware per parsare il corpo delle richieste in formato JSON
app.use(express.json());
// Middleware per servire file statici dalla directory 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- INIZIO INIZIALIZZAZIONE DATABASE ---

// Ottieni il percorso assoluto dove verrà creato/aperto il database
const dbPath = path.join(__dirname, 'database.sqlite');
console.log('Tentativo di connessione/creazione database al percorso:', dbPath);

// Inizializzazione del database SQLite
// Il database verrà creato nella stessa directory di server.js se non esiste
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Errore nell\'apertura/creazione del database:', err.message);
        // È cruciale che se non si apre, il server si fermi o gestisca l'errore
        process.exit(1); // Esci dal processo se il DB non può essere aperto
    } else {
        console.log('Connesso al database SQLite.');
        // db.serialize() assicura che le operazioni sul database vengano eseguite in sequenza
        db.serialize(() => {
            // Creazione della tabella degli utenti
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student' -- 'admin' o 'student'
            )`, (err) => {
                if (err) {
                    console.error('Errore nella creazione tabella users:', err.message);
                } else {
                    console.log('Tabella users creata o già esistente.');

                    // Creazione dell'utente amministratore predefinito se non esiste
                    db.get(`SELECT * FROM users WHERE username = 'admin'`, [], (err, row) => {
                        if (err) {
                            console.error('Errore nel controllo utente admin:', err.message);
                            return;
                        }
                        if (!row) {
                            // Hash della password dell'amministratore
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

            // Creazione della tabella dei corsi
            db.run(`CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            )`, (err) => {
                if (err) {
                    console.error('Errore nella creazione tabella courses:', err.message);
                } else {
                    console.log('Tabella courses creata o già esistente.');
                }
            });

            // Creazione della tabella degli studenti (e gestione iscrizioni)
            db.run(`CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL, -- Collega allo user.id della tabella users
                registration_number TEXT UNIQUE NOT NULL,
                birth_date TEXT,
                address TEXT,
                phone TEXT,
                email TEXT UNIQUE NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`, (err) => {
                if (err) {
                    console.error('Errore nella creazione tabella students:', err.message);
                } else {
                    console.log('Tabella students creata o già esistente.');
                }
            });

            // Tabella per le iscrizioni degli studenti ai corsi
            db.run(`CREATE TABLE IF NOT EXISTS student_courses (
                student_id INTEGER,
                course_id INTEGER,
                PRIMARY KEY (student_id, course_id),
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            )`, (err) => {
                if (err) {
                    console.error('Errore nella creazione tabella student_courses:', err.message);
                } else {
                    console.log('Tabella student_courses creata o già esistente.');
                    console.log('Tutte le tabelle create o verificate.');
                }
            });
        });
    }
});

// --- FINE INIZIALIZZAZIONE DATABASE ---

// Middleware per proteggere le route
function authenticateRole(role) {
    return (req, res, next) => {
        // Se non autenticato e la richiesta non è per login/register, reindirizza alla pagina di login
        if (!req.session.userId) {
            // Per richieste API che si aspettano JSON, invia un 401 Unauthorized
            if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({ error: 'Non autenticato. Effettua il login.' });
            }
            // Per richieste di pagina, reindirizza alla home (pagina di login)
            return res.redirect('/');
        }

        // Se l'utente è autenticato, controlla il ruolo
        db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err) {
                console.error('Errore nel recupero ruolo utente:', err.message);
                return res.status(500).json({ error: 'Errore interno del server.' });
            }
            if (!user || user.role !== role) {
                // Utente non trovato o ruolo non corrispondente
                if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
                    return res.status(403).json({ error: 'Accesso negato. Ruolo non autorizzato.' });
                }
                // Reindirizza a una pagina appropriata in base al ruolo o errore
                if (req.session.userRole === 'student') {
                    return res.redirect('/student-dashboard');
                }
                return res.redirect('/'); // Se il ruolo non è 'admin' o 'student', reindirizza al login
            }
            // Se autenticato e autorizzato, continua
            next();
        });
    };
}

// --- ROTTE STATICHE ---

// Servire la pagina di login/registrazione all'URL radice
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Servire la dashboard amministrativa (protetta)
app.get('/admin-dashboard', authenticateRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servire la dashboard studente (protetta)
app.get('/student-dashboard', authenticateRole('student'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});


// --- ROTTE API DI AUTENTICAZIONE ---

// API di registrazione
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    // Hash della password prima di salvarla
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Errore durante l\'hashing della password:', err.message);
            return res.status(500).json({ error: 'Errore interno del server durante la registrazione.' });
        }

        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, 'student')`,
            [username, hash], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed: users.username')) {
                        return res.status(409).json({ error: 'Username già in uso.' });
                    }
                    console.error('Errore durante la registrazione utente:', err.message);
                    return res.status(500).json({ error: 'Errore durante la registrazione dell\'utente.' });
                }

                const userId = this.lastID; // ID del nuovo utente creato

                // Inserimento nello schema studenti
                db.run(`INSERT INTO students (user_id, registration_number, email) VALUES (?, ?, ?)`,
                    [userId, `REG-${Date.now()}`, email], function (err) { // registration_number generato automaticamente
                        if (err) {
                            console.error('Errore durante la registrazione dello studente:', err.message);
                            // Potresti voler fare il rollback dell'utente se la registrazione studente fallisce
                            return res.status(500).json({ error: 'Errore durante la registrazione dello studente.' });
                        }
                        res.status(201).json({ message: 'Registrazione studente avvenuta con successo.' });
                    });
            });
    });
});

// API di login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT id, username, password, role FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Errore durante il recupero utente per il login:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Credenziali non valide.' });
        }

        // Confronta la password fornita con l'hash salvato
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Errore durante il confronto password:', err.message);
                return res.status(500).json({ error: 'Errore interno del server.' });
            }
            if (!result) {
                return res.status(401).json({ error: 'Credenziali non valide.' });
            }

            // Credenziali valide, imposta la sessione
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.userRole = user.role;

            res.json({ message: 'Login avvenuto con successo.', role: user.role });
        });
    });
});

// API per ottenere informazioni sull'utente corrente
app.get('/api/user-info', (req, res) => {
    if (req.session.userId) {
        db.get('SELECT username, role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err) {
                console.error('Errore nel recupero user info:', err.message);
                return res.status(500).json({ error: 'Errore interno del server.' });
            }
            if (user) {
                return res.json(user);
            }
            // Se l'utente non è trovato (es. ID sessione non valido nel DB)
            req.session.destroy(); // Distruggi la sessione non valida
            res.status(401).json({ error: 'Sessione non valida. Rilogati.' });
        });
    } else {
        res.status(401).json({ error: 'Non autenticato.' });
    }
});

// API di logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Errore durante il logout:', err.message);
            return res.status(500).json({ error: 'Errore durante il logout.' });
        }
        res.status(200).json({ message: 'Logout avvenuto con successo.' });
    });
});

// --- ROTTE API AMMINISTRATIVE (PROTETTE) ---

// API per ottenere tutti i corsi (solo admin)
app.get('/api/courses', authenticateRole('admin'), (req, res) => {
    db.all('SELECT * FROM courses', [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero corsi:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        res.json(rows);
    });
});

// API per aggiungere un corso (solo admin)
app.post('/api/courses', authenticateRole('admin'), (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Il nome del corso è obbligatorio.' });
    }
    db.run(`INSERT INTO courses (name, description) VALUES (?, ?)`, [name, description], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Un corso con questo nome esiste già.' });
            }
            console.error('Errore nell\'aggiunta corso:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        res.status(201).json({ message: 'Corso aggiunto con successo.', id: this.lastID });
    });
});

// API per eliminare un corso (solo admin)
app.delete('/api/courses/:id', authenticateRole('admin'), (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM courses WHERE id = ?`, id, function (err) {
        if (err) {
            console.error('Errore nell\'eliminazione corso:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Corso non trovato.' });
        }
        res.json({ message: 'Corso eliminato con successo.' });
    });
});


// API per ottenere tutti gli studenti (solo admin)
app.get('/api/students', authenticateRole('admin'), (req, res) => {
    db.all(`SELECT s.id, u.username, s.registration_number, s.birth_date, s.address, s.phone, s.email
            FROM students s
            JOIN users u ON s.user_id = u.id`, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero studenti:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        res.json(rows);
    });
});

// API per eliminare uno studente (solo admin)
app.delete('/api/students/:id', authenticateRole('admin'), (req, res) => {
    const { id } = req.params;

    db.get('SELECT user_id FROM students WHERE id = ?', [id], (err, student) => {
        if (err) {
            console.error('Errore nel recupero user_id dello studente per l\'eliminazione:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (!student) {
            return res.status(404).json({ error: 'Studente non trovato.' });
        }

        // Inizia una transazione per eliminare da student_courses, students e users
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            // 1. Elimina le iscrizioni dello studente ai corsi
            db.run(`DELETE FROM student_courses WHERE student_id = ?`, [id], (err) => {
                if (err) {
                    console.error('Errore nell\'eliminazione iscrizioni studente:', err.message);
                    db.run('ROLLBACK;');
                    return res.status(500).json({ error: 'Errore nell\'eliminazione delle iscrizioni dello studente.' });
                }

                // 2. Elimina lo studente dalla tabella students
                db.run(`DELETE FROM students WHERE id = ?`, [id], (err) => {
                    if (err) {
                        console.error('Errore nell\'eliminazione studente dalla tabella students:', err.message);
                        db.run('ROLLBACK;');
                        return res.status(500).json({ error: 'Errore nell\'eliminazione dello studente.' });
                    }

                    // 3. Elimina l'utente dalla tabella users
                    db.run(`DELETE FROM users WHERE id = ?`, [student.user_id], function (err) {
                        if (err) {
                            console.error('Errore nell\'eliminazione utente dalla tabella users:', err.message);
                            db.run('ROLLBACK;');
                            return res.status(500).json({ error: 'Errore nell\'eliminazione dell\'utente.' });
                        }
                        if (this.changes === 0) { // Questo dovrebbe essere 0 solo se user_id non corrisponde
                            console.warn('Avviso: Utente non trovato per l\'ID:', student.user_id);
                        }

                        db.run('COMMIT;', (commitErr) => {
                            if (commitErr) {
                                console.error('Errore nel commit della transazione di eliminazione studente:', commitErr.message);
                                return res.status(500).json({ error: 'Errore nel completamento dell\'eliminazione dello studente.' });
                            }
                            res.json({ message: 'Studente e dati associati eliminati con successo.' });
                        });
                    });
                });
            });
        });
    });
});


// API per aggiornare i dettagli di uno studente (solo admin)
app.put('/api/students/:id', authenticateRole('admin'), (req, res) => {
    const { id } = req.params;
    const { username, registration_number, birth_date, address, phone, email } = req.body;

    if (!username || !registration_number || !email) {
        return res.status(400).json({ error: 'Username, numero di matricola ed email sono obbligatori.' });
    }

    db.get('SELECT user_id FROM students WHERE id = ?', [id], (err, student) => {
        if (err) {
            console.error('Errore nel recupero user_id per aggiornamento studente:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (!student) {
            return res.status(404).json({ error: 'Studente non trovato.' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');

            // Aggiorna la tabella users
            db.run(`UPDATE users SET username = ? WHERE id = ?`, [username, student.user_id], (err) => {
                if (err) {
                    console.error('Errore nell\'aggiornamento username utente:', err.message);
                    db.run('ROLLBACK;');
                    return res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'utente.' });
                }

                // Aggiorna la tabella students
                db.run(`UPDATE students SET registration_number = ?, birth_date = ?, address = ?, phone = ?, email = ? WHERE id = ?`,
                    [registration_number, birth_date, address, phone, email, id], function (err) {
                        if (err) {
                            console.error('Errore nell\'aggiornamento dati studente:', err.message);
                            db.run('ROLLBACK;');
                            return res.status(500).json({ error: 'Errore nell\'aggiornamento dello studente.' });
                        }
                        if (this.changes === 0) {
                            console.warn('Avviso: Nessun cambiamento apportato per lo studente ID:', id);
                        }

                        db.run('COMMIT;', (commitErr) => {
                            if (commitErr) {
                                console.error('Errore nel commit della transazione di aggiornamento studente:', commitErr.message);
                                return res.status(500).json({ error: 'Errore nel completamento dell\'aggiornamento dello studente.' });
                            }
                            res.json({ message: 'Dati studente aggiornati con successo.' });
                        });
                    });
            });
        });
    });
});


// API per ottenere i corsi a cui è iscritto uno studente (solo admin)
app.get('/api/students/:id/courses', authenticateRole('admin'), (req, res) => {
    const { id } = req.params;
    db.all(`SELECT c.id, c.name FROM courses c
            JOIN student_courses sc ON c.id = sc.course_id
            WHERE sc.student_id = ?`, [id], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero corsi studente:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        res.json(rows);
    });
});

// API per iscrivere uno studente a un corso (solo admin)
app.post('/api/students/:studentId/courses/:courseId', authenticateRole('admin'), (req, res) => {
    const { studentId, courseId } = req.params;
    db.run(`INSERT INTO student_courses (student_id, course_id) VALUES (?, ?)`, [studentId, courseId], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Studente già iscritto a questo corso.' });
            }
            if (err.message.includes('FOREIGN KEY constraint failed')) {
                return res.status(400).json({ error: 'ID studente o corso non validi.' });
            }
            console.error('Errore nell\'iscrizione studente al corso:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        res.status(201).json({ message: 'Studente iscritto al corso con successo.' });
    });
});

// API per disiscrivere uno studente da un corso (solo admin)
app.delete('/api/students/:studentId/courses/:courseId', authenticateRole('admin'), (req, res) => {
    const { studentId, courseId } = req.params;
    db.run(`DELETE FROM student_courses WHERE student_id = ? AND course_id = ?`, [studentId, courseId], function (err) {
        if (err) {
            console.error('Errore nella disiscrizione studente dal corso:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Iscrizione non trovata.' });
        }
        res.json({ message: 'Studente disiscritto dal corso con successo.' });
    });
});

// --- ROTTE API STUDENTE (PROTETTE) ---

// API per ottenere i corsi a cui è iscritto lo studente loggato
app.get('/api/my-courses', authenticateRole('student'), (req, res) => {
    // Prima, trova l'ID dello studente collegato all'utente loggato
    db.get('SELECT id FROM students WHERE user_id = ?', [req.session.userId], (err, student) => {
        if (err) {
            console.error('Errore nel recupero ID studente per my-courses:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (!student) {
            return res.status(404).json({ error: 'Profilo studente non trovato associato a questo utente.' });
        }

        // Poi, recupera i corsi a cui è iscritto questo studente
        db.all(`SELECT c.id, c.name, c.description FROM courses c
                JOIN student_courses sc ON c.id = sc.course_id
                WHERE sc.student_id = ?`, [student.id], (err, rows) => {
            if (err) {
                console.error('Errore nel recupero miei corsi:', err.message);
                return res.status(500).json({ error: 'Errore interno del server.' });
            }
            res.json(rows);
        });
    });
});

// API per ottenere i dettagli dello studente loggato
app.get('/api/my-profile', authenticateRole('student'), (req, res) => {
    db.get(`SELECT u.username, s.registration_number, s.birth_date, s.address, s.phone, s.email
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE u.id = ?`, [req.session.userId], (err, profile) => {
        if (err) {
            console.error('Errore nel recupero profilo studente:', err.message);
            return res.status(500).json({ error: 'Errore interno del server.' });
        }
        if (!profile) {
            return res.status(404).json({ error: 'Profilo studente non trovato.' });
        }
        res.json(profile);
    });
});


// Avvio del server
app.listen(port, () => {
    console.log(`Server del portale in ascolto su http://localhost:${port}`);
    console.log(`Accedi all'admin: http://localhost:${port}/admin-dashboard (Username: admin, Password: adminpassword)`);
    console.log(`Accedi alla pagina di login: http://localhost:${port}`);
});