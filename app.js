const firebaseConfig = {
    apiKey: "AIzaSyAMnVzitl6x0c1Y45kN-t6GVWlSow-AOBo",
    authDomain: "retrocloud-a81ca.firebaseapp.com",
    projectId: "retrocloud-a81ca",
    storageBucket: "retrocloud-a81ca.firebasestorage.app",
    messagingSenderId: "402145528540",
    appId: "1:402145528540:web:012cab3343f8ced18d4219"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const authStatus = document.getElementById('auth-status');
const userDisplay = document.getElementById('user-display');
const authError = document.getElementById('auth-error');
const uploadStatus = document.getElementById('upload-status');
const fileTableBody = document.getElementById('file-table-body');
const storageQuota = document.getElementById('storage-quota');
const searchInput = document.getElementById('search-input');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');

const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');

let cachedFiles = [];

function sanitizeString(str) {
    const element = document.createElement('div');
    element.innerText = str;
    return element.innerHTML;
}

auth.onAuthStateChanged((user) => {
    if (user) {
        authStatus.innerText = "CONNECTED";
        authStatus.style.color = "#00ffcc";
        userDisplay.innerText = "USER: " + user.email;
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        loadUserFiles(user.uid);
    } else {
        authStatus.innerText = "DISCONNECTED";
        authStatus.style.color = "#ff3333";
        userDisplay.innerText = "USER: UNKNOWN";
        dashboardView.classList.add('hidden');
        authView.classList.remove('hidden');
        fileTableBody.innerHTML = "";
        storageQuota.innerText = "VAULT: 0 KB / 10 MB";
    }
});

registerBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    authError.innerText = "";

    if (!email || !password) {
        authError.innerText = "ERROR: CREDENTIALS CANNOT BE EMPTY.";
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .catch((error) => {
            authError.innerText = "REGISTRATION FAILED: " + sanitizeString(error.message);
        });
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    authError.innerText = "";

    if (!email || !password) {
        authError.innerText = "ERROR: CREDENTIALS CANNOT BE EMPTY.";
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            authError.innerText = "LOGIN FAILED: " + sanitizeString(error.message);
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().catch((error) => {
        console.error("Sign out error:", error);
    });
});

uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const file = fileInput.files[0];
    if (!file) return;

    // 10MB limit check
    if (file.size > 10485760) {
        uploadStatus.innerText = "ERROR: FILE EXCEEDS 10MB LIMIT.";
        return;
    }

    uploadStatus.innerText = "UPLOADING TO VAULT...";

    const filePath = `users/${user.uid}/${Date.now()}_${file.name}`;
    const storageRef = storage.ref().child(filePath);

    storageRef.put(file)
        .then((snapshot) => {
            return snapshot.ref.getDownloadURL();
        })
        .then((downloadURL) => {
            const sanitizedFileName = sanitizeString(file.name);

            const fileRecord = {
                userId: user.uid,
                name: sanitizedFileName,
                size: file.size,
                type: file.type,
                storagePath: filePath,
                downloadURL: downloadURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            return db.collection('files').add(fileRecord);
        })
        .then(() => {
            uploadStatus.innerText = "SUCCESS: FILE STORED.";
            uploadForm.reset();
            setTimeout(() => { uploadStatus.innerText = ""; }, 3000);
        })
        .catch((error) => {
            uploadStatus.innerText = "ERROR: UPLOAD FAILED - " + sanitizeString(error.message);
        });
});

function loadUserFiles(uid) {
    db.collection('files')
        .where('userId', '==', uid)
        .onSnapshot((snapshot) => {
            cachedFiles = [];
            let totalBytes = 0;

            snapshot.forEach((doc) => {
                cachedFiles.push({ id: doc.id, ...doc.data() });
            });

            cachedFiles.forEach(file => {
                totalBytes += (file.size || 0);
            });

            const totalKb = (totalBytes / 1024).toFixed(1);
            storageQuota.innerText = `VAULT: ${totalKb} KB / 10240 KB`;

            renderTable(cachedFiles);
        }, (error) => {
            console.error("Error reading file stream:", error);
            fileTableBody.innerHTML = `<tr><td colspan="4" style="color:red;">ACCESS RESTRICTED.</td></tr>`;
        });
}

function renderTable(files) {
    fileTableBody.innerHTML = "";
    
    if (files.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="4" style="text-align:center;">NO FILES FOUND IN VAULT.</td>`;
        fileTableBody.appendChild(emptyRow);
        return;
    }

    files.forEach((fileData) => {
        const tr = document.createElement('tr');
        
        let dateStr = "UNKNOWN DATE";
        if (fileData.createdAt && fileData.createdAt.toDate) {
            dateStr = fileData.createdAt.toDate().toISOString().replace('T', ' ').substring(0, 19);
        }

        tr.innerHTML = `
            <td>${sanitizeString(fileData.name)}</td>
            <td>${fileData.size}</td>
            <td>${dateStr}</td>
            <td>
                <button class="action-btn download-btn" data-url="${fileData.downloadURL}" data-name="${sanitizeString(fileData.name)}">GET</button>
                <button class="action-btn delete-btn" data-id="${fileData.id}">DEL</button>
            </td>
        `;
        fileTableBody.appendChild(tr);
    });

    bindTableActions();
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = cachedFiles.filter(file => file.name.toLowerCase().includes(term));
    renderTable(filtered);
});

function bindTableActions() {
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.getAttribute('data-url');
            const name = e.target.getAttribute('data-name');
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.target = "_blank";
            downloadLink.download = name;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fileId = e.target.getAttribute('data-id');
            if (confirm("CONFIRM DELETION OF RECORD?")) {
                db.collection('files').doc(fileId).get()
                    .then((doc) => {
                        if (doc.exists) {
                            const storagePath = doc.data().storagePath;
                            if (storagePath) {
                                storage.ref().child(storagePath).delete().catch(err => console.log(err));
                            }
                        }
                        return db.collection('files').doc(fileId).delete();
                    })
                    .catch((error) => {
                        alert("DELETE FAILED: " + error.message);
                    });
            }
        });
    });
}
