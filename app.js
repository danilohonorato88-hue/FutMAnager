import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5oziSBnCs3nuiH_sQisDSm9V1BzkO00c",
  authDomain: "futmanager-31038.firebaseapp.com",
  projectId: "futmanager-31038",
  storageBucket: "futmanager-31038.firebasestorage.app",
  messagingSenderId: "101127013387",
  appId: "1:101127013387:web:3681d06abac0391240330e",
  measurementId: "G-RPGNPFGMKV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const stateRef = doc(db, 'futManager', 'mainState');

// Global functions for inline HTML onclick handlers
window.removePlayer = null;
window.undoConfirm = null;
window.undoArrival = null;

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let state = {
        players: [], 
        matchDate: '',
        matchTime: '',
        draftCompleted: false,
        teamA: [],
        teamB: []
    };

    function saveState() {
        // Envia para o Firebase
        setDoc(stateRef, state).catch(err => console.error("Erro ao salvar:", err));
    }

    // Escuta o Firebase em tempo real (Reage a qualquer mundança sua ou de outros celulares)
    onSnapshot(stateRef, (docSnap) => {
        if (docSnap.exists()) {
            state = docSnap.data();
            renderAll();
        } else {
            // Documento não existe ainda, vamos criá-lo
            saveState(); 
        }
    });

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // --- DOM Elements ---
    const els = {
        date: document.getElementById('match-date'),
        time: document.getElementById('match-time'),
        form: document.getElementById('add-player-form'),
        nameInput: document.getElementById('player-name'),
        listLinha: document.getElementById('list-linha'),
        listGoleiro: document.getElementById('list-goleiro'),
        countLinha: document.getElementById('count-linha'),
        countGoleiro: document.getElementById('count-goleiro'),
        
        confirmSelect: document.getElementById('confirm-player-select'),
        btnConfirm: document.getElementById('btn-confirm-player'),
        confListLinha: document.getElementById('confirmed-list-linha'),
        confListGoleiro: document.getElementById('confirmed-list-goleiro'),
        countConfLinha: document.getElementById('count-confirmed-linha'),
        countConfGoleiro: document.getElementById('count-confirmed-goleiro'),
        
        arrivalSelect: document.getElementById('arrival-player-select'),
        btnArrival: document.getElementById('btn-mark-arrival'),
        draftPool: document.getElementById('draft-pool-list'),
        btnDraft: document.getElementById('btn-run-draft'),
        draftResults: document.getElementById('draft-results'),
        teamAList: document.getElementById('team-a-list'),
        teamBList: document.getElementById('team-b-list'),
        nextTeams: document.getElementById('next-teams-container'),
        shareArea: document.getElementById('share-area'),
        btnShare: document.getElementById('btn-share'),
        
        tabs: document.querySelectorAll('.tab-btn'),
        panes: document.querySelectorAll('.tab-pane')
    };

    // --- Navigation ---
    els.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            els.tabs.forEach(b => b.classList.remove('active'));
            els.panes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // --- Event Listeners ---
    els.date.addEventListener('change', (e) => { state.matchDate = e.target.value; saveState(); });
    els.time.addEventListener('change', (e) => { state.matchTime = e.target.value; saveState(); });

    els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = els.nameInput.value.trim();
        const role = document.querySelector('input[name="player-role"]:checked').value;
        if (!name) return;

        state.players.push({
            id: generateId(),
            name: name,
            role: role,
            confirmedAt: null,
            arrivedAt: null
        });

        els.nameInput.value = '';
        saveState();
    });

    els.btnConfirm.addEventListener('click', () => {
        const id = els.confirmSelect.value;
        if (!id) return;
        const player = state.players.find(p => p.id === id);
        if (player) {
            player.confirmedAt = Date.now();
            saveState();
        }
    });

    els.btnArrival.addEventListener('click', () => {
        const id = els.arrivalSelect.value;
        if (!id) return;
        const player = state.players.find(p => p.id === id);
        if (player) {
            player.arrivedAt = Date.now();
            saveState();
        }
    });

    els.btnDraft.addEventListener('click', () => {
        runDraft();
    });

    els.btnShare?.addEventListener('click', () => {
        const originalText = els.btnShare.innerHTML;
        els.btnShare.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando imagem...';
        els.btnShare.disabled = true;

        const removeBtns = els.shareArea.querySelectorAll('.btn-remove');
        removeBtns.forEach(btn => btn.style.display = 'none');

        // Render the canvas
        if (window.html2canvas) {
            window.html2canvas(els.shareArea, {
                backgroundColor: '#0f172a',
                scale: 2 // Melhor resolução
            }).then(canvas => {
                removeBtns.forEach(btn => btn.style.display = '');
                els.btnShare.innerHTML = originalText;
                els.btnShare.disabled = false;

                const link = document.createElement('a');
                link.download = 'times-futsal.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(err => {
                console.error("Erro ao gerar imagem", err);
                removeBtns.forEach(btn => btn.style.display = '');
                els.btnShare.innerHTML = originalText;
                els.btnShare.disabled = false;
            });
        }
    });

    // Ações para deletar / desfazer
    window.removePlayer = (id) => {
        state.players = state.players.filter(p => p.id !== id);
        checkDraftInvalidation(id);
        saveState();
    };

    window.undoConfirm = (id) => {
        const player = state.players.find(p => p.id === id);
        if (player) {
            player.confirmedAt = null;
            player.arrivedAt = null;
            checkDraftInvalidation(id);
            saveState();
        }
    };

    window.undoArrival = (id) => {
        const player = state.players.find(p => p.id === id);
        if (player) {
            player.arrivedAt = null;
            checkDraftInvalidation(id);
            saveState();
        }
    };

    function checkDraftInvalidation(id) {
        if (state.teamA.find(p => p.id === id) || state.teamB.find(p => p.id === id)) {
            state.draftCompleted = false;
            state.teamA = [];
            state.teamB = [];
        }
    }

    // --- Render Functions ---
    function renderPlayers() {
        const linha = state.players.filter(p => p.role === 'linha').sort((a,b) => a.name.localeCompare(b.name));
        const goleiro = state.players.filter(p => p.role === 'goleiro').sort((a,b) => a.name.localeCompare(b.name));

        els.countLinha.textContent = linha.length;
        els.countGoleiro.textContent = goleiro.length;

        els.listLinha.innerHTML = linha.map(p => playerHtml(p, 'remove')).join('');
        els.listGoleiro.innerHTML = goleiro.map(p => playerHtml(p, 'remove')).join('');
    }

    function renderConfirmations() {
        const confirmed = state.players.filter(p => p.confirmedAt).sort((a,b) => a.confirmedAt - b.confirmedAt);
        const linha = confirmed.filter(p => p.role === 'linha');
        const goleiro = confirmed.filter(p => p.role === 'goleiro');

        els.countConfLinha.textContent = linha.length;
        els.countConfGoleiro.textContent = goleiro.length;

        els.confListLinha.innerHTML = linha.map(p => playerHtml(p, 'undoConfirm')).join('');
        els.confListGoleiro.innerHTML = goleiro.map(p => playerHtml(p, 'undoConfirm')).join('');

        // Dropdown Confirmar (somente não confirmados)
        const unconfirmed = state.players.filter(p => !p.confirmedAt).sort((a,b) => a.name.localeCompare(b.name));
        els.confirmSelect.innerHTML = `<option value="" disabled selected>Selecione um jogador...</option>` + 
            unconfirmed.map(p => `<option value="${p.id}">${p.name} (${p.role.toUpperCase()})</option>`).join('');
    }

    function renderArrivals() {
        const arrived = state.players.filter(p => p.arrivedAt).sort((a,b) => a.arrivedAt - b.arrivedAt);
        const confirmedNotArrived = state.players.filter(p => p.confirmedAt && !p.arrivedAt).sort((a,b) => a.confirmedAt - b.confirmedAt);
        
        els.arrivalSelect.innerHTML = `<option value="" disabled selected>Marcar chegada de...</option>` + 
            confirmedNotArrived.map(p => `<option value="${p.id}">${p.name} (${p.role.toUpperCase()})</option>`).join('');

        const arrivedLinha = arrived.filter(p => p.role === 'linha');
        const arrivedGoleiro = arrived.filter(p => p.role === 'goleiro');

        // Primeiros 8 linha e 2 goleiros que chegaram
        const draftPoolGoleiros = arrivedGoleiro.slice(0, 2);
        const draftPoolLinha = arrivedLinha.slice(0, 8);
        const draftPool = [...draftPoolGoleiros, ...draftPoolLinha];
        
        els.draftPool.innerHTML = draftPool.map(p => playerHtml(p, 'undoArrival', state.draftCompleted)).join('');

        // Habilita botão de sorteio apenas se tiver 8 de linha e 2 goleiros e o sorteio não tiver acontecido
        if (arrivedLinha.length >= 8 && arrivedGoleiro.length >= 2 && !state.draftCompleted) {
            els.btnDraft.disabled = false;
        } else {
            els.btnDraft.disabled = true;
        }

        // Renderiza os times sorteados
        if (state.draftCompleted) {
            els.draftResults.classList.remove('hidden');
            els.teamAList.innerHTML = state.teamA.map(p => playerHtml(p, '', true)).join('');
            els.teamBList.innerHTML = state.teamB.map(p => playerHtml(p, '', true)).join('');
        } else {
            els.draftResults.classList.add('hidden');
            els.teamAList.innerHTML = '';
            els.teamBList.innerHTML = '';
        }
        
        renderNextTeams();
    }

    function renderNextTeams() {
        let draftedIds = new Set();
        if (state.draftCompleted) {
            draftedIds = new Set([...state.teamA.map(p=>p.id), ...state.teamB.map(p=>p.id)]);
        }

        const remainingConfirmed = state.players
            .filter(p => p.confirmedAt && !draftedIds.has(p.id))
            .sort((a, b) => a.confirmedAt - b.confirmedAt);
        
        let remainingGoleiros = remainingConfirmed.filter(p => p.role === 'goleiro');
        let remainingLinha = remainingConfirmed.filter(p => p.role === 'linha');
        
        let customTeams = [];
        
        while(remainingLinha.length > 0 || remainingGoleiros.length > 0) {
            let teamPlayers = [];
            if (remainingGoleiros.length > 0) {
                teamPlayers.push(remainingGoleiros.shift());
            }
            while(teamPlayers.length < 5 && remainingLinha.length > 0) {
                teamPlayers.push(remainingLinha.shift());
            }
            customTeams.push(teamPlayers);
        }

        if (customTeams.length === 0) {
            els.nextTeams.innerHTML = '<p class="instruction">Não há jogadores suficientes na fila de espera.</p>';
        } else {
            let html = '';
            customTeams.forEach((team, index) => {
                html += `
                <div class="next-team-block">
                    <h4>Próximo Time ${index + 1}</h4>
                    <ul class="player-list">
                        ${team.map(p => playerHtml(p, '', true)).join('')}
                    </ul>
                </div>`;
            });
            els.nextTeams.innerHTML = html;
        }
    }

    function runDraft() {
        const arrived = state.players.filter(p => p.arrivedAt).sort((a,b) => a.arrivedAt - b.arrivedAt);
        const arrivedLinha = arrived.filter(p => p.role === 'linha').slice(0, 8);
        const arrivedGoleiro = arrived.filter(p => p.role === 'goleiro').slice(0, 2);

        if (arrivedLinha.length < 8 || arrivedGoleiro.length < 2) return;

        // Embaralha para o sorteio
        const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
        
        const shuffledLinha = shuffle(arrivedLinha);
        const shuffledGoleiro = shuffle(arrivedGoleiro);

        state.teamA = [shuffledGoleiro[0], ...shuffledLinha.slice(0, 4)];
        state.teamB = [shuffledGoleiro[1], ...shuffledLinha.slice(4, 8)];
        state.draftCompleted = true;
        saveState();
    }

    function playerHtml(player, action, hideAction = false) {
        let actionBtn = '';
        if (!hideAction) {
            if (action === 'remove') {
                actionBtn = `<button class="btn-remove" title="Remover" onclick="removePlayer('${player.id}')"><i class="fa-solid fa-trash"></i></button>`;
            } else if (action === 'undoConfirm') {
                actionBtn = `<button class="btn-remove" title="Remover Confirmação" onclick="undoConfirm('${player.id}')"><i class="fa-solid fa-xmark"></i></button>`;
            } else if (action === 'undoArrival') {
                actionBtn = `<button class="btn-remove" title="Remover Chegada" onclick="undoArrival('${player.id}')"><i class="fa-solid fa-xmark"></i></button>`;
            }
        }
        
        return `
            <li class="player-item">
                <div class="player-info">
                    <span class="player-name">${player.name}</span>
                    <span class="player-role-badge ${player.role}">${player.role.toUpperCase()}</span>
                </div>
                ${actionBtn}
            </li>
        `;
    }

    // Inicialização do Visual sem dados para não dar erro
    els.date.value = state.matchDate;
    els.time.value = state.matchTime;
    function renderAll() {
        els.date.value = state.matchDate;
        els.time.value = state.matchTime;
        renderPlayers();
        renderConfirmations();
        renderArrivals();
    }
});
