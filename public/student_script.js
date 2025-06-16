// student_script.js (per la dashboard studente)

document.addEventListener('DOMContentLoaded', () => {
    const sidebarNavStudent = document.querySelector('.sidebar .navigation ul');
    const pageTitleStudent = document.getElementById('page-title-student');
    const userDisplayNameStudent = document.getElementById('user-display-name-student');
    const logoutBtnStudent = document.getElementById('logout-btn-student');

    const sectionsStudent = {
        'student-dashboard': document.getElementById('student-dashboard-content'),
        'my-courses': document.getElementById('my-courses-content')
    };

    // Elementi specifici per i corsi studente
    const studentCoursesGrid = document.querySelector('.student-courses-grid');
    const totalAssignedCoursesEl = document.getElementById('total-assigned-courses');

    // Modale video (riutilizzata dall'admin)
    const videoModal = document.getElementById('video-modal');
    const videoTitle = document.getElementById('video-title');
    const videoEmbedContainer = document.getElementById('video-embed-container');
    const externalLinkBtn = document.getElementById('external-link-btn');

    let currentStudentId = null; // Sarà impostato dopo il checkAuth

    // Funzione per controllare lo stato di autenticazione e caricare i dati dello studente
    async function checkAuthAndLoadStudentData() {
        try {
            const response = await fetch('/api/user-info');
            if (!response.ok) {
                window.location.href = '/'; // Reindirizza al login se non autenticato
                return;
            }
            const userInfo = await response.json();
            if (userInfo.role !== 'student' || !userInfo.studentId) {
                window.location.href = '/'; // Reindirizza al login o admin dashboard se non è uno studente valido
                return;
            }
            userDisplayNameStudent.textContent = userInfo.username;
            currentStudentId = userInfo.studentId; // Salva l'ID dello studente loggato

            // Carica i dati iniziali per la dashboard
            loadMyCourses();
            loadStudentDashboardSummary();

        } catch (error) {
            console.error('Errore nel controllo autenticazione studente:', error);
            window.location.href = '/'; // Reindirizza al login in caso di errore di rete
        }
    }

    // Gestione Logout per lo studente
    logoutBtnStudent.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/logout');
            if (response.ok) {
                alert('Logout effettuato con successo.');
                window.location.href = '/'; // Reindirizza alla pagina di login
            } else {
                const errorData = await response.json();
                alert(`Errore durante il logout: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Errore di rete durante il logout:', error);
            alert('Errore di connessione al server durante il logout.');
        }
    });

    // Funzione per mostrare la sezione corretta nello studente
    function showStudentSection(sectionId) {
        Object.values(sectionsStudent).forEach(section => section.classList.add('hidden'));
        sectionsStudent[sectionId].classList.remove('hidden');
        pageTitleStudent.textContent = sectionId === 'my-courses' ? 'I Miei Corsi' : 'Home Studente';

        document.querySelectorAll('.sidebar .navigation ul li').forEach(li => li.classList.remove('active'));
        const activeMenuItem = document.querySelector(`.sidebar .navigation ul li[data-section="${sectionId}"]`);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }

        if (sectionId === 'my-courses' && currentStudentId) {
            loadMyCourses();
        } else if (sectionId === 'student-dashboard') {
            loadStudentDashboardSummary();
        }
    }

    // Carica i corsi assegnati allo studente
    async function loadMyCourses() {
        if (!currentStudentId) {
            studentCoursesGrid.innerHTML = '<p style="color: red;">Impossibile caricare i corsi: ID studente non disponibile.</p>';
            return;
        }
        try {
            // L'API /api/courses è stata modificata per restituire solo i corsi dello studente se il ruolo è 'student'
            const response = await fetch(`/api/courses`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore nel caricamento dei tuoi corsi.');
            }
            const courses = await response.json();
            studentCoursesGrid.innerHTML = '';
            if (courses.length === 0) {
                studentCoursesGrid.innerHTML = '<p>Non hai ancora corsi assegnati. Contatta l\'amministratore.</p>';
                return;
            }
            courses.forEach(course => {
                const courseCard = document.createElement('div');
                courseCard.classList.add('student-course-card');

                // Regex per estrarre l'ID video da YouTube o Vimeo
                let embedSrc = '';
                if (course.videoUrl.includes('youtube.com/watch?v=')) {
                    const videoId = course.videoUrl.split('v=')[1];
                    embedSrc = `https://www.youtube.com/embed/${videoId}`;
                } else if (course.videoUrl.includes('youtu.be/')) {
                    const videoId = course.videoUrl.split('youtu.be/')[1];
                    embedSrc = `https://www.youtube.com/embed/${videoId}`;
                } else if (course.videoUrl.includes('vimeo.com/')) {
                    const videoId = course.videoUrl.split('/').pop();
                    embedSrc = `https://player.vimeo.com/video/${videoId}`;
                } else {
                    embedSrc = course.videoUrl; // Fallback per altri URL diretti (non per iframe)
                }

                courseCard.innerHTML = `
                    <h3>${course.title} (Settimana ${course.week})</h3>
                    <p>${course.description || 'Nessuna descrizione disponibile.'}</p>
                    <div class="course-actions">
                        <button class="view-course-btn" data-id="${course.id}" data-video-embed="${embedSrc}" data-link="${course.externalLink || ''}" data-title="${course.title}">Vedi Contenuto</button>
                    </div>
                `;
                studentCoursesGrid.appendChild(courseCard);
            });
        } catch (error) {
            console.error('Errore nel caricamento dei corsi dello studente:', error);
            studentCoursesGrid.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // Carica il riepilogo della dashboard studente
    async function loadStudentDashboardSummary() {
        if (!currentStudentId) {
            totalAssignedCoursesEl.textContent = 'N/A';
            return;
        }
        try {
            // Usa l'API /api/students/:id/courses per contare i corsi assegnati
            const response = await fetch(`/api/students/${currentStudentId}/courses`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Impossibile caricare i corsi per il riepilogo.');
            }
            const courses = await response.json();
            totalAssignedCoursesEl.textContent = courses.length;
        } catch (error) {
            console.error('Errore nel caricamento del riepilogo dashboard studente:', error);
            totalAssignedCoursesEl.textContent = 'N/A';
            // Non mostrare alert per un errore che lo studente non può risolvere
        }
    }


    // Gestione della visualizzazione video (riutilizzata)
    const closeButtonsModal = document.querySelectorAll('#video-modal .close-button');
    closeButtonsModal.forEach(button => {
        button.addEventListener('click', () => {
            videoModal.style.display = 'none';
            videoEmbedContainer.innerHTML = ''; // Pulisce l'iframe quando si chiude
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === videoModal) {
            videoModal.style.display = 'none';
            videoEmbedContainer.innerHTML = '';
        }
    });

    studentCoursesGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('view-course-btn')) {
            const videoEmbedSrc = event.target.dataset.videoEmbed;
            const externalLink = event.target.dataset.link;
            const title = event.target.dataset.title;

            videoTitle.textContent = title;
            videoEmbedContainer.innerHTML = ''; // Pulisce il contenuto precedente

            // Incorpora il video o il link diretto
            if (videoEmbedSrc.includes('youtube.com/embed') || videoEmbedSrc.includes('player.vimeo.com/video')) {
                videoEmbedContainer.innerHTML = `<iframe src="${videoEmbedSrc}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else {
                // Per altri URL, o un semplice tag video HTML5 se il link è diretto al file video
                videoEmbedContainer.innerHTML = `<video controls width="100%" height="auto"><source src="${videoEmbedSrc}" type="video/mp4">Il tuo browser non supporta il tag video.</video>`;
            }

            if (externalLink && externalLink !== 'null' && externalLink !== '') {
                externalLinkBtn.href = externalLink;
                externalLinkBtn.style.display = 'inline-block';
            } else {
                externalLinkBtn.style.display = 'none';
            }

            videoModal.style.display = 'flex';
        }
    });


    // Gestione della navigazione (cambio sezione)
    sidebarNavStudent.addEventListener('click', (event) => {
        const listItem = event.target.closest('li');
        if (listItem && listItem.dataset.section) {
            showStudentSection(listItem.dataset.section);
        }
    });

    // Inizializza la dashboard studente all'avvio
    checkAuthAndLoadStudentData();
    showStudentSection('student-dashboard'); // Mostra la sezione home dello studente di default
});