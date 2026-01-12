import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig, IMGBB_KEY } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user = null;
let activeChatId = null;
let msgUnsub = null;

// --- УТИЛИТЫ ---
function fmtTime(ts) {
    if(!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.showScreen = (id, el) => {
    if (msgUnsub && id !== 'msg') { msgUnsub(); msgUnsub = null; }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('scr-' + id).classList.add('active');
    if(el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
    }
    lucide.createIcons();
};

// --- АВТОРИЗАЦИЯ ---
document.getElementById('toggleAuth').onclick = () => {
    const b = document.getElementById('reg-box');
    const isLogin = b.style.display === 'none';
    b.style.display = isLogin ? 'block' : 'none';
    document.getElementById('toggleAuth').innerText = isLogin ? 'Уже есть аккаунт' : 'Создать аккаунт';
};

document.getElementById('authBtn').onclick = async () => {
    const e = document.getElementById('email').value, p = document.getElementById('pass').value;
    if(!e || !p) return;
    try {
        if(document.getElementById('reg-box').style.display === 'block') {
            const n = document.getElementById('nick').value;
            const res = await createUserWithEmailAndPassword(auth, e, p);
            const ava = `https://api.dicebear.com/7.x/identicon/svg?seed=${n}`;
            await updateProfile(res.user, { displayName: n, photoURL: ava });
            await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, nick: n.toLowerCase(), avatar: ava });
        } else { await signInWithEmailAndPassword(auth, e, p); }
    } catch (err) { alert(err.message); }
};

onAuthStateChanged(auth, u => {
    if(u) {
        user = u;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('myPic').src = u.photoURL;
        document.getElementById('myNickDisplay').innerText = u.displayName;
        initFeed();
        initChatList();
    } else { document.getElementById('auth-screen').style.display = 'flex'; }
});

// ... ОСТАЛЬНЫЕ ФУНКЦИИ (initFeed, openChat, initChatList, и т.д.)
// Просто перенеси сюда все функции, которые были внутри <script type="module"> в твоем индексном файле.

// Глобальные функции для HTML (нужно привязать к window, так как это модуль)
window.logout = () => signOut(auth).then(() => location.reload());
window.toggleTheme = () => {
    document.body.dataset.theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
};

// Не забудь про deepDeleteChat и прочие функции, вешай их на window
window.deepDeleteChat = async (chatId, e) => { /* твой код */ };
window.openChat = (otherId, nick, ava) => { /* твой код */ };
