// script.js (per il pannello amministratore)

document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi DOM
    const sidebarNav = document.querySelector('.navigation ul');
    const pageTitle = document.getElementById('page-title');
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');

    const sections = {
        'dashboard': document.getElementById('dashboard-content'),
        'courses': document.getElementById('courses-content'),
        'students': document.getElementById('students-content'),
        'messages': document.getElementById('messages-content'),
        'settings': document.getElementById('settings-content')
    };

    // Elementi per la gestione Corsi
    const addCourseBtn = document.getElementById('add-course-btn');
    const courseFormModal = document.getElementById('course-form-modal');
    const courseFormTitle = document.getElementById('course-form-title');
    const courseForm = document.getElementById('course-form');
    const courseIdInput = document.getElementById('course-id');
    const courseTitleInput = document.getElementById('course-title');
    const courseDescriptionInput = document.getElementById('course-description');
    const courseVideoInput = document.getElementById('course-video');
    const courseLinkInput = document.getElementById('course-link');
    const courseWeekInput = document.getElementById('course-week');
    const courseListDiv = document.querySelector('#courses-content .course-list');
    const videoModal = document.getElementById('video-modal');
    const videoTitle = document.getElementById('video-title');
    const videoEmbedContainer = document.getElementById('video-embed-container');
    const externalLinkBtn = document.getElementById('external-link-btn');

    // Elementi per la gestione Studenti
    const addStudentBtn = document.getElementById('add-student-btn');
    const studentFormModal = document.getElementById('student-form-modal');
    const studentFormTitle = document.getElementById('student-form-title');
    const studentForm = document.getElementById('student-form');
    const studentIdInput = document.getElementById('student-id');
    const studentNameInput = document.getElementById('student-name');
    const studentEmailInput = document.getElementById('student-email');
    const studentTableBody = document.querySelector('#students-content tbody');

    // Elementi per la gestione Assegnazione Corsi
    const assignCoursesModal = document.getElementById('assign-courses-modal');
    const assignCoursesTitle = document.getElementById('assign-courses-title');
    const studentNameAssign = document.getElementById('student-name-assign');
    const coursesAssignmentListDiv = document.querySelector('#assign-courses-modal .courses-assignment-list');
    const saveAssignmentsBtn = document.getElementById('save-assignments-btn');
    let currentStudentIdForAssignment = null;

    // Elementi dashboard
    const totalStudentsEl = document.getElementById('total-students');
    const totalCoursesEl = document.getElementById('total-courses');

    // Funzione per controllare lo stato di autenticazione all'avvio della pagina
    async function checkAuthAndRedirect() {
        try {
            const response = await fetch('/api/user-info');
            if (!response.ok) {
                // Se non autenticato o sessione scaduta, reindirizza al login
                window.location.href = '/';
                return;
            }
            const userInfo = await response.json();
            if (userInfo.role !== 'admin') {
                // Se non è un admin, reindirizza alla dashboard studente (o login se non loggato)
                window.location.href = '/student-dashboard';
                return;
            }
            userDisplayName.textContent = userInfo.username;
        } catch (error) {
            console.error('Errore nel controllo autenticazione:', error);
            window.location.href = '/'; // Reindirizza al login in caso di errore di rete
        }
    }

    // Gestione Logout
    logoutBtn.addEventListener('click', async (e) => {
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

    // Funzioni helper per i modali
    const closeButtons = document.querySelectorAll('.close-button');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            courseFormModal.style.display = 'none';
            studentFormModal.style.display = 'none';
            videoModal.style.display = 'none';
            assignCoursesModal.style.display = 'none';
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === courseFormModal) {
            courseFormModal.style.display = 'none';
        } else if (event.target === studentFormModal) {
            studentFormModal.style.display = 'none';
        } else if (event.target === videoModal) {
            videoModal.style.display = 'none';
        } else if (event.target === assignCoursesModal) {
            assignCoursesModal.style.display = 'none';
        }
    });

    // Funzione per mostrare la sezione corretta
    function showSection(sectionId) {
        Object.values(sections).forEach(section => section.classList.add('hidden'));
        sections[sectionId].classList.remove('hidden');
        pageTitle.textContent = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
        document.querySelectorAll('.navigation ul li').forEach(li => li.classList.remove('active'));
        const activeMenuItem = document.querySelector(`.navigation ul li[data-section="${sectionId}"]`);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }

        if (sectionId === 'courses') {
            loadCourses();
        } else if (sectionId === 'students') {
            loadStudents();
        } else if (sectionId === 'dashboard') {
            loadDashboardSummary();
        }
    }

    // --- Gestione Corsi ---

    async function loadCourses() {
        try {
            const response = await fetch('/api/courses');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore nel caricamento dei corsi.');
            }
            const courses = await response.json();
            courseListDiv.innerHTML = '';
            if (courses.length === 0) {
                courseListDiv.innerHTML = '<p>Nessun corso disponibile. Aggiungi un nuovo corso!</p>';
                return;
            }
            courses.forEach(course => {
                const courseCard = document.createElement('div');
                courseCard.classList.add('course-card');
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
                    <p>${course.description || 'Nessuna descrizione.'}</p>
                    <div class="course-actions">
                        <button class="view-course-btn" data-id="${course.id}" data-video-embed="${embedSrc}" data-link="${course.externalLink || ''}" data-title="${course.title}">Vedi Corso</button>
                        <button class="edit-course-btn edit" data-id="${course.id}">Modifica</button>
                        <button class="delete-course-btn delete" data-id="${course.id}">Elimina</button>
                    </div>
                `;
                courseListDiv.appendChild(courseCard);
            });
        } catch (error) {
            console.error('Errore nel caricamento dei corsi:', error);
            courseListDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    addCourseBtn.addEventListener('click', () => {
        courseFormTitle.textContent = 'Aggiungi Nuovo Corso';
        courseForm.reset();
        courseIdInput.value = '';
        courseFormModal.style.display = 'flex';
    });

    courseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = courseIdInput.value;
        const courseData = {
            title: courseTitleInput.value,
            description: courseDescriptionInput.value,
            videoUrl: courseVideoInput.value,
            externalLink: courseLinkInput.value,
            week: parseInt(courseWeekInput.value)
        };

        try {
            let response;
            if (id) {
                response = await fetch(`/api/courses/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(courseData)
                });
            } else {
                response = await fetch('/api/courses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(courseData)
                });
            }

            if (response.ok) {
                alert(`Corso ${id ? 'aggiornato' : 'aggiunto'} con successo!`);
                courseFormModal.style.display = 'none';
                loadCourses();
                loadDashboardSummary();
            } else {
                const errorData = await response.json();
                alert(`Errore: ${errorData.error || 'Qualcosa è andato storto.'}`);
            }
        } catch (error) {
            console.error('Errore nell\'operazione del corso:', error);
            alert('Si è verificato un errore di rete.');
        }
    });

    courseListDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('edit-course-btn')) {
            const courseId = event.target.dataset.id;
            try {
                const response = await fetch(`/api/courses`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Errore nel recupero dei corsi.');
                }
                const courses = await response.json();
                const courseToEdit = courses.find(c => c.id == courseId);
                if (courseToEdit) {
                    courseFormTitle.textContent = 'Modifica Corso';
                    courseIdInput.value = courseToEdit.id;
                    courseTitleInput.value = courseToEdit.title;
                    courseDescriptionInput.value = courseToEdit.description || '';
                    courseVideoInput.value = courseToEdit.videoUrl;
                    courseLinkInput.value = courseToEdit.externalLink || '';
                    courseWeekInput.value = courseToEdit.week;
                    courseFormModal.style.display = 'flex';
                } else {
                    alert('Corso non trovato.');
                }
            } catch (error) {
                console.error('Errore nel recupero del corso per modifica:', error);
                alert(`Errore: ${error.message}`);
            }
        } else if (event.target.classList.contains('delete-course-btn')) {
            const courseId = event.target.dataset.id;
            if (confirm('Sei sicuro di voler eliminare questo corso? Tutte le assegnazioni ad esso verranno rimosse.')) {
                try {
                    const response = await fetch(`/api/courses/${courseId}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        alert('Corso eliminato con successo!');
                        loadCourses();
                        loadDashboardSummary();
                    } else {
                        const errorData = await response.json();
                        alert(`Errore: ${errorData.error || 'Qualcosa è andato storto.'}`);
                    }
                } catch (error) {
                    console.error('Errore nell\'eliminazione del corso:', error);
                    alert('Si è verificato un errore di rete.');
                }
            }
        } else if (event.target.classList.contains('view-course-btn')) {
            const videoEmbedSrc = event.target.dataset.videoEmbed;
            const externalLink = event.target.dataset.link;
            const title = event.target.dataset.title;

            videoTitle.textContent = title;
            videoEmbedContainer.innerHTML = '';

            if (videoEmbedSrc.includes('youtube.com/embed') || videoEmbedSrc.includes('player.vimeo.com/video')) {
                videoEmbedContainer.innerHTML = `<iframe src="${videoEmbedSrc}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else {
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


    // --- Gestione Studenti ---

    async function loadStudents() {
        try {
            const response = await fetch('/api/students');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore nel caricamento degli studenti.');
            }
            const students = await response.json();
            studentTableBody.innerHTML = '';
            if (students.length === 0) {
                studentTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nessuno studente registrato. Aggiungi un nuovo studente!</td></tr>';
                return;
            }
            students.forEach(student => {
                const row = studentTableBody.insertRow();
                row.innerHTML = `
                    <td>${student.id}</td>
                    <td>${student.name}</td>
                    <td>${student.email}</td>
                    <td>${student.assigned_courses_count}</td>
                    <td class="action-buttons">
                        <button class="assign-courses-btn" data-id="${student.id}" data-name="${student.name}">Assegna Corsi</button>
                        <button class="edit-student-btn edit" data-id="${student.id}">Modifica</button>
                        <button class="delete-student-btn delete" data-id="${student.id}">Elimina</button>
                    </td>
                `;
            });
        } catch (error) {
            console.error('Errore nel caricamento degli studenti:', error);
            studentTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">${error.message}</td></tr>`;
        }
    }

    addStudentBtn.addEventListener('click', () => {
        studentFormTitle.textContent = 'Aggiungi Nuovo Studente';
        studentForm.reset();
        studentIdInput.value = '';
        studentFormModal.style.display = 'flex';
    });

    studentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = studentIdInput.value;
        const studentData = {
            name: studentNameInput.value,
            email: studentEmailInput.value
        };

        try {
            let response;
            if (id) {
                response = await fetch(`/api/students/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(studentData)
                });
            } else {
                response = await fetch('/api/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(studentData)
                });
            }

            if (response.ok) {
                alert(`Studente ${id ? 'aggiornato' : 'aggiunto'} con successo!`);
                studentFormModal.style.display = 'none';
                loadStudents();
                loadDashboardSummary();
            } else {
                const errorData = await response.json();
                alert(`Errore: ${errorData.error || 'Qualcosa è andato storto.'}`);
            }
        } catch (error) {
            console.error('Errore nell\'operazione dello studente:', error);
            alert('Si è verificato un errore di rete.');
        }
    });

    studentTableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('edit-student-btn')) {
            const studentId = event.target.dataset.id;
            try {
                const response = await fetch('/api/students');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Errore nel recupero degli studenti.');
                }
                const students = await response.json();
                const studentToEdit = students.find(s => s.id == studentId);
                if (studentToEdit) {
                    studentFormTitle.textContent = 'Modifica Studente';
                    studentIdInput.value = studentToEdit.id;
                    studentNameInput.value = studentToEdit.name;
                    studentEmailInput.value = studentToEdit.email;
                    studentFormModal.style.display = 'flex';
                } else {
                    alert('Studente non trovato.');
                }
            } catch (error) {
                console.error('Errore nel recupero studente per modifica:', error);
                alert(`Errore: ${error.message}`);
            }
        } else if (event.target.classList.contains('delete-student-btn')) {
            const studentId = event.target.dataset.id;
            if (confirm('Sei sicuro di voler eliminare questo studente? Tutti i suoi corsi assegnati e l\'account utente verranno rimossi.')) {
                try {
                    const response = await fetch(`/api/students/${studentId}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        alert('Studente eliminato con successo!');
                        loadStudents();
                        loadDashboardSummary();
                    } else {
                        const errorData = await response.json();
                        alert(`Errore: ${errorData.error || 'Qualcosa è andato storto.'}`);
                    }
                } catch (error) {
                    console.error('Errore nell\'eliminazione dello studente:', error);
                    alert('Si è verificato un errore di rete.');
                }
            }
        } else if (event.target.classList.contains('assign-courses-btn')) {
            const studentId = event.target.dataset.id;
            const studentName = event.target.dataset.name;
            currentStudentIdForAssignment = studentId;

            studentNameAssign.textContent = studentName;
            assignCoursesModal.style.display = 'flex';
            loadCoursesForAssignment(studentId);
        }
    });

    async function loadCoursesForAssignment(studentId) {
        try {
            const [allCoursesResponse, studentCoursesResponse] = await Promise.all([
                fetch('/api/courses'),
                fetch(`/api/students/${studentId}/courses`)
            ]);

            if (!allCoursesResponse.ok) {
                const errorData = await allCoursesResponse.json();
                throw new Error(errorData.error || 'Errore nel caricamento di tutti i corsi.');
            }
            if (!studentCoursesResponse.ok) {
                const errorData = await studentCoursesResponse.json();
                throw new Error(errorData.error || `Errore nel caricamento dei corsi per lo studente ${studentId}.`);
            }

            const allCourses = await allCoursesResponse.json();
            const studentCourses = await studentCoursesResponse.json();

            coursesAssignmentListDiv.innerHTML = '';

            if (allCourses.length === 0) {
                coursesAssignmentListDiv.innerHTML = '<p>Nessun corso disponibile per l\'assegnazione.</p>';
                return;
            }

            allCourses.forEach(course => {
                const isAssigned = studentCourses.some(sc => sc.id === course.id);
                const checkboxDiv = document.createElement('div');
                checkboxDiv.classList.add('course-assignment-item');
                checkboxDiv.innerHTML = `
                    <label>
                        <input type="checkbox" data-course-id="${course.id}" ${isAssigned ? 'checked' : ''}>
                        ${course.title} (Settimana ${course.week})
                    </label>
                `;
                coursesAssignmentListDiv.appendChild(checkboxDiv);
            });
        } catch (error) {
            console.error('Errore nel caricamento dei corsi per l\'assegnazione:', error);
            coursesAssignmentListDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    saveAssignmentsBtn.addEventListener('click', async () => {
        if (!currentStudentIdForAssignment) {
            alert('Errore: Nessuno studente selezionato.');
            return;
        }

        const checkboxes = coursesAssignmentListDiv.querySelectorAll('input[type="checkbox"]');
        const assignmentsToMake = [];
        const assignmentsToRemove = [];

        try {
            const responseStudentCourses = await fetch(`/api/students/${currentStudentIdForAssignment}/courses`);
            if (!responseStudentCourses.ok) {
                const errorData = await responseStudentCourses.json();
                throw new Error(errorData.error || 'Impossibile recuperare i corsi assegnati attuali.');
            }
            const currentStudentCourses = await responseStudentCourses.json();
            const currentCourseIds = new Set(currentStudentCourses.map(c => c.id));

            for (const checkbox of checkboxes) {
                const courseId = parseInt(checkbox.dataset.courseId);
                const isChecked = checkbox.checked;

                if (isChecked && !currentCourseIds.has(courseId)) {
                    assignmentsToMake.push({ student_id: currentStudentIdForAssignment, course_id: courseId });
                } else if (!isChecked && currentCourseIds.has(courseId)) {
                    assignmentsToRemove.push({ student_id: currentStudentIdForAssignment, course_id: courseId });
                }
            }

            await Promise.all(assignmentsToRemove.map(async (assignment) => {
                const res = await fetch(`/api/enrollments/${assignment.student_id}/${assignment.course_id}`, {
                    method: 'DELETE'
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(`Errore eliminazione iscrizione: ${errorData.error}`);
                }
            }));

            await Promise.all(assignmentsToMake.map(async (assignment) => {
                const res = await fetch('/api/enrollments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(assignment)
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    if (errorData.error && errorData.error.includes('Studente già iscritto')) {
                        console.warn(`Tentativo duplicato di iscrizione ignorato: ${errorData.error}`);
                    } else {
                        throw new Error(`Errore aggiunta iscrizione: ${errorData.error}`);
                    }
                }
            }));

            alert('Assegnazioni salvate con successo!');
            assignCoursesModal.style.display = 'none';
            loadStudents();
        } catch (error) {
            console.error('Errore nel salvataggio delle assegnazioni:', error);
            alert(`Errore nel salvataggio delle assegnazioni: ${error.message}. Controlla la console.`);
        }
    });


    // Carica il riepilogo per la dashboard
    async function loadDashboardSummary() {
        try {
            // Per il conteggio corsi e studenti, usiamo le API esistenti
            const coursesResponse = await fetch('/api/courses');
            if (!coursesResponse.ok) throw new Error('Impossibile caricare i corsi per il riepilogo.');
            const courses = await coursesResponse.json();
            totalCoursesEl.textContent = courses.length;

            const studentsResponse = await fetch('/api/students');
            if (!studentsResponse.ok) throw new Error('Impossibile caricare gli studenti per il riepilogo.');
            const students = await studentsResponse.json();
            totalStudentsEl.textContent = students.length;
        } catch (error) {
            console.error('Errore nel caricamento del riepilogo dashboard:', error);
            totalCoursesEl.textContent = 'N/A';
            totalStudentsEl.textContent = 'N/A';
            alert(`Errore Dashboard: ${error.message}`);
        }
    }


    // Gestione della navigazione (cambio sezione)
    sidebarNav.addEventListener('click', (event) => {
        const listItem = event.target.closest('li');
        if (listItem && listItem.dataset.section) {
            showSection(listItem.dataset.section);
        }
    });

    // Inizializza mostrando la dashboard all'avvio dopo il controllo di autenticazione
    checkAuthAndRedirect();
    showSection('dashboard');
});