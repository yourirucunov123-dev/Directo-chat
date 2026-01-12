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

// --- ЖДЕМ ЗАГРУЗКИ HTML (Чтобы не было ошибки null) ---
document.addEventListener('DOMContentLoaded', () => {

    // --- УТИЛИТЫ ---
    function fmtTime(ts) {
        if(!ts) return "";
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    window.showScreen = (id, el) => {
        if (msgUnsub && id !== 'msg') { msgUnsub(); msgUnsub = null; }
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById('scr-' + id);
        if(target) target.classList.add('active');
        
        if(el) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
        }
        if(window.lucide) lucide.createIcons();
    };

    // --- АВТОРИЗАЦИЯ ---
    const toggleAuthBtn = document.getElementById('toggleAuth');
    if(toggleAuthBtn) {
        toggleAuthBtn.onclick = () => {
            const b = document.getElementById('reg-box');
            const isLogin = b.style.display === 'none';
            b.style.display = isLogin ? 'block' : 'none';
            toggleAuthBtn.innerText = isLogin ? 'Уже есть аккаунт' : 'Создать аккаунт';
        };
    }

    const authBtn = document.getElementById('authBtn');
    if(authBtn) {
        authBtn.onclick = async () => {
            const e = document.getElementById('email').value, p = document.getElementById('pass').value;
            if(!e || !p) return;
            try {
                if(document.getElementById('reg-box').style.display === 'block') {
                    const n = document.getElementById('nick').value;
                    const res = await createUserWithEmailAndPassword(auth, e, p);
                    const ava = `https://api.dicebear.com/7.x/identicon/svg?seed=${n}`;
                    await updateProfile(res.user, { displayName: n, photoURL: ava });
                    await setDoc(doc(db, "users", res.user.uid), { uid: res.user.uid, nick: n.toLowerCase(), avatar: ava });
                } else { 
                    await signInWithEmailAndPassword(auth, e, p); 
                }
            } catch (err) { alert(err.message); }
        };
    }

    onAuthStateChanged(auth, u => {
        if(u) {
            user = u;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('myPic').src = u.photoURL;
            document.getElementById('myNickDisplay').innerText = u.displayName;
            initFeed();
            initChatList();
        } else { 
            document.getElementById('auth-screen').style.display = 'flex'; 
        }
    });

    // --- ЛЕНТА ---
    function initFeed() {
        onSnapshot(query(collection(db, "feed"), orderBy("time", "desc"), limit(20)), (snaps) => {
            const box = document.getElementById('feed-items'); 
            if(!box) return;
            box.innerHTML = "";
            snaps.forEach(d => {
                const p = d.data();
                box.innerHTML += `<div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.ava}" class="ava" style="width:30px; height:30px;"><b>${p.user}</b>
                    </div>
                    <p style="margin:0">${p.text || ""}</p>
                    ${p.url ? `<img src="${p.url}" class="post-img">` : ""}
                </div>`;
            });
        });
    }

    // --- ПОИСК ---
    const searchInput = document.getElementById('searchUser');
    if(searchInput) {
        searchInput.oninput = async (e) => {
            const val = e.target.value.toLowerCase().trim();
            const resBox = document.getElementById('searchRes');
            if(val.length < 2) { resBox.style.display = 'none'; return; }
            onSnapshot(query(collection(db, "users"), where("nick", ">=", val), limit(5)), (snaps) => {
                resBox.innerHTML = "";
                snaps.forEach(s => {
                    const u = s.data(); if(u.uid === user.uid) return;
                    const row = document.createElement('div'); row.className = 'user-row';
                    row.innerHTML = `<img src="${u.avatar}" class="ava" style="width:30px;height:30px"> <span>${u.nick}</span>`;
                    row.onclick = () => window.openChat(u.uid, u.nick, u.avatar);
                    resBox.appendChild(row);
                });
                resBox.style.display = resBox.innerHTML ? 'block' : 'none';
            });
        };
    }

    // --- ЧАТЫ И СООБЩЕНИЯ ---
    window.openChat = (otherId, nick, ava) => {
        activeChatId = user.uid < otherId ? user.uid + "_" + otherId : otherId + "_" + user.uid;
        document.getElementById('chat-title').innerText = nick;
        document.getElementById('chat-ava').src = ava;
        document.getElementById('searchRes').style.display = 'none';
        document.getElementById('searchUser').value = "";
        window.showScreen('msg');
        initMessages();
    };

    function initChatList() {
        onSnapshot(query(collection(db, "conversations"), where("users", "array-contains", user.uid), orderBy("time", "desc")), async (snaps) => {
            const list = document.getElementById('chat-list'); 
            if(!list) return;
            list.innerHTML = "";
            for (const d of snaps.docs) {
                const conv = d.data();
                const otherId = conv.users.find(id => id !== user.uid);
                const uDoc = await getDoc(doc(db, "users", otherId));
                if (!uDoc.exists()) continue;
                const other = uDoc.data();
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.onclick = () => window.openChat(otherId, other.nick, other.avatar);
                item.innerHTML = `
                    <img src="${other.avatar}" class="ava">
                    <div class="chat-info">
                        <div class="chat-row"><b>${other.nick}</b><span class="chat-time">${fmtTime(conv.time)}</span></div>
                        <div class="chat-row">
                            <div class="chat-last-msg">${conv.lastMsg || "..."}</div>
                            <div class="delete-btn" onclick="window.deepDeleteChat('${d.id}', event)"><i data-lucide="trash-2" size="16"></i></div>
                        </div>
                    </div>`;
                list.appendChild(item);
            }
            if(window.lucide) lucide.createIcons();
        });
    }

    function initMessages() {
        if(msgUnsub) msgUnsub();
        msgUnsub = onSnapshot(query(collection(db, "chats", activeChatId, "messages"), orderBy("time", "asc")), (snaps) => {
            const box = document.getElementById('messages-box');
            box.innerHTML = "";
            snaps.forEach(d => {
                const m = d.data();
                const b = document.createElement('div');
                b.className = `bubble ${m.uid === user.uid ? 'me' : 'not-me'}`;
                b.innerHTML = `${m.text}<span class="msg-time">${fmtTime(m.time)}</span>`;
                box.appendChild(b);
            });
            box.scrollTop = box.scrollHeight;
        });
    }

    document.getElementById('sendMsg').onclick = async () => {
        const input = document.getElementById('msgInput'), txt = input.value.trim();
        if(!txt || !activeChatId) return;
        const cid = activeChatId; input.value = "";
        await addDoc(collection(db, "chats", cid, "messages"), { text: txt, uid: user.uid, time: serverTimestamp() });
        await setDoc(doc(db, "conversations", cid), { lastMsg: txt, time: serverTimestamp(), users: cid.split('_') }, { merge: true });
    };

    // --- ФУНКЦИИ УДАЛЕНИЯ И ТЕМЫ ---
    window.deepDeleteChat = async (chatId, e) => {
        e.stopPropagation();
        if(!confirm("Удалить чат?")) return;
        const msgs = await getDocs(collection(db, "chats", chatId, "messages"));
        const batch = writeBatch(db);
        msgs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await deleteDoc(doc(db, "conversations", chatId));
    };

    window.logout = () => signOut(auth).then(() => location.reload());
    window.toggleTheme = () => {
        document.body.dataset.theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
    };

    document.getElementById('deleteAccBtn').onclick = async () => {
        if(confirm("Удалить аккаунт?")) {
            await deleteDoc(doc(db, "users", user.uid));
            await deleteUser(auth.currentUser);
            location.reload();
        }
    };

    // Посты
    document.getElementById('addPostBtn').onclick = () => {
        const p = document.getElementById('post-input');
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
    };

    document.getElementById('sendPost').onclick = async () => {
        const t = document.getElementById('postText'), f = document.getElementById('postFile');
        const fd = new FormData(); 
        let url = "";
        if(f.files[0]) {
            fd.append("image", f.files[0]);
            const r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
            const d = await r.json();
            url = d.data.url;
        }
        if(!t.value && !url) return;
        await addDoc(collection(db, "feed"), { text: t.value, url: url, user: user.displayName, ava: user.photoURL, time: serverTimestamp() });
        t.value = ""; f.value = ""; document.getElementById('post-input').style.display = 'none';
    };

});
