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

// Global action flags / functions
window.removePlayer = null;
window.undoConfirm = null;
window.undoArrival = null;
window.markArrival = null;

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
        setDoc(stateRef, state).catch(err => console.error("Erro ao salvar:", err));
    }
    
    function getNextTuesday() {
        const d = new Date();
        const day = d.getDay();
        const diff = (2 - day + 7) % 7;
        d.setDate(d.getDate() + diff);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    onSnapshot(stateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Garantir que os arrays existem
            state.players = data.players || [];
            state.teamA = data.teamA || [];
            state.teamB = data.teamB || [];
            state.draftCompleted = data.draftCompleted || false;
            
            // Converter nomes antigos para maiúsculo caso existam
            let migrated = false;
            state.players.forEach(p => {
                if (p.name !== p.name.toUpperCase()) {
                    p.name = p.name.toUpperCase();
                    migrated = true;
                }
            });

            // Se for base vazia sem data
            if (!data.matchDate || !data.matchTime) {
                state.matchDate = getNextTuesday();
                state.matchTime = '20:00';
                saveState();
            } else {
                state.matchDate = data.matchDate;
                state.matchTime = data.matchTime;
                if (migrated) {
                    saveState();
                } else {
                    renderAll();
                }
            }
        } else {
            // First time creating the document
            state.matchDate = getNextTuesday();
            state.matchTime = '20:00';
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
        
        // Confirmations
        unconfListLinha: document.getElementById('unconfirmed-list-linha'),
        unconfListGoleiro: document.getElementById('unconfirmed-list-goleiro'),
        btnConfirmMultiple: document.getElementById('btn-confirm-multiple'),
        confListLinha: document.getElementById('confirmed-list-linha'),
        confListGoleiro: document.getElementById('confirmed-list-goleiro'),
        countConfTotal: document.getElementById('count-confirmed-total'),
        countConfLinha: document.getElementById('count-confirmed-linha'),
        countConfGoleiro: document.getElementById('count-confirmed-goleiro'),
        
        // Arrivals
        waitingGoleiro: document.getElementById('waiting-arrival-goleiro'),
        waitingLinha: document.getElementById('waiting-arrival-linha'),
        draftPool: document.getElementById('draft-pool-list'),
        btnDraft: document.getElementById('btn-run-draft'),
        
        // Share / Results
        draftResults: document.getElementById('draft-results'),
        teamAList: document.getElementById('team-a-list'),
        teamBList: document.getElementById('team-b-list'),
        nextTeams: document.getElementById('next-teams-container'),
        shareArea: document.getElementById('share-area'),
        btnShare: document.getElementById('btn-share'),
        imageHeader: document.getElementById('image-header'),
        imageDateTime: document.getElementById('image-date-time'),
        
        btnFinishMatch: document.getElementById('btn-finish-match'),
        
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
        const rawName = els.nameInput.value.trim();
        const role = document.querySelector('input[name="player-role"]:checked').value;
        if (!rawName) return;

        state.players.push({
            id: generateId(),
            name: rawName.toUpperCase(),
            role: role,
            confirmedAt: null,
            arrivedAt: null
        });

        els.nameInput.value = '';
        saveState();
    });

    els.btnConfirmMultiple.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.confirm-checkbox:checked');
        if (checkboxes.length === 0) return;
        
        let now = Date.now();
        checkboxes.forEach(cb => {
            const id = cb.value;
            const player = state.players.find(p => p.id === id);
            if (player) {
                player.confirmedAt = now++; // increment slightly to keep selection order
            }
        });
        saveState();
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
        
        // Show Image Header
        if(state.matchDate) {
            const parts = state.matchDate.split('-');
            let formattedDate = state.matchDate;
            if (parts.length === 3) {
                 formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            els.imageDateTime.textContent = `${formattedDate}` + (state.matchTime ? ` às ${state.matchTime}` : '');
            els.imageHeader.style.display = 'block';
        }
        
        els.shareArea.style.background = '#0f172a';
        els.shareArea.style.padding = '25px';

        // Render the canvas
        if (window.html2canvas) {
            window.html2canvas(els.shareArea, {
                backgroundColor: '#0f172a',
                scale: 2
            }).then(canvas => {
                removeBtns.forEach(btn => btn.style.display = '');
                els.imageHeader.style.display = 'none';
                els.shareArea.style.background = 'transparent';
                els.shareArea.style.padding = '15px';
                
                els.btnShare.innerHTML = originalText;
                els.btnShare.disabled = false;

                const link = document.createElement('a');
                let filenameDate = state.matchDate;
                if (!filenameDate) {
                    const now = new Date();
                    filenameDate = now.toISOString().split('T')[0];
                }
                link.download = `times-futsal-${filenameDate}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(err => {
                console.error("Erro ao gerar imagem", err);
                removeBtns.forEach(btn => btn.style.display = '');
                els.imageHeader.style.display = 'none';
                els.shareArea.style.background = 'transparent';
                els.shareArea.style.padding = '15px';
                els.btnShare.innerHTML = originalText;
                els.btnShare.disabled = false;
            });
        }
    });

    els.btnFinishMatch.addEventListener('click', () => {
        if(confirm("Tem certeza que deseja finalizar a partida de hoje? Isso irá limpar todas as confirmações e chegadas, mas o elenco será mantido.")) {
            state.draftCompleted = false;
            state.teamA = [];
            state.teamB = [];
            state.players.forEach(p => {
                p.confirmedAt = null;
                p.arrivedAt = null;
            });
            
            // Advance matchdate to Next Tuesday
            state.matchDate = getNextTuesday();
            
            saveState();
            
            els.tabs[0].click(); // Redireciona para Elenco
        }
    });

    // Ações globais para botões
    window.removePlayer = (id) => {
        if(confirm("Remover este jogador do Elenco?")) {
            state.players = state.players.filter(p => p.id !== id);
            checkDraftInvalidation(id);
            saveState();
        }
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

    window.markArrival = (id) => {
        const player = state.players.find(p => p.id === id);
        if (player) {
            player.arrivedAt = Date.now();
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
        const unconfirmed = state.players.filter(p => !p.confirmedAt).sort((a,b) => a.name.localeCompare(b.name));
        
        const unconfLinha = unconfirmed.filter(p => p.role === 'linha');
        const unconfGoleiro = unconfirmed.filter(p => p.role === 'goleiro');

        const confLinha = confirmed.filter(p => p.role === 'linha');
        const confGoleiro = confirmed.filter(p => p.role === 'goleiro');

        els.unconfListGoleiro.innerHTML = unconfGoleiro.length ? unconfGoleiro.map(p => playerCheckboxHtml(p)).join('') : '<li class="player-item empty-state">Nenhum goleiro aguardando</li>';
        els.unconfListLinha.innerHTML = unconfLinha.length ? unconfLinha.map(p => playerCheckboxHtml(p)).join('') : '<li class="player-item empty-state">Nenhum jogador aguardando</li>';

        els.countConfTotal.textContent = confirmed.length;
        els.countConfLinha.textContent = confLinha.length;
        els.countConfGoleiro.textContent = confGoleiro.length;

        els.confListLinha.innerHTML = confLinha.length ? confLinha.map(p => playerHtml(p, 'undoConfirm')).join('') : '<li class="player-item empty-state">Nenhum confirmado</li>';
        els.confListGoleiro.innerHTML = confGoleiro.length ? confGoleiro.map(p => playerHtml(p, 'undoConfirm')).join('') : '<li class="player-item empty-state">Nenhum confirmado</li>';
    }

    function renderArrivals() {
        const arrived = state.players.filter(p => p.arrivedAt).sort((a,b) => a.arrivedAt - b.arrivedAt);
        const waitingArrival = state.players.filter(p => p.confirmedAt && !p.arrivedAt).sort((a,b) => a.confirmedAt - b.confirmedAt);
        
        const waitingGoleiro = waitingArrival.filter(p => p.role === 'goleiro');
        const waitingLinha = waitingArrival.filter(p => p.role === 'linha');
        
        els.waitingGoleiro.innerHTML = waitingGoleiro.length ? waitingGoleiro.map(p => playerArrivalHtml(p)).join('') : '<li class="player-item empty-state">Nenhum goleiro na espera</li>';
        els.waitingLinha.innerHTML = waitingLinha.length ? waitingLinha.map(p => playerArrivalHtml(p)).join('') : '<li class="player-item empty-state">Nenhum jogador na espera</li>';

        const arrivedLinha = arrived.filter(p => p.role === 'linha');
        const arrivedGoleiro = arrived.filter(p => p.role === 'goleiro');

        // Primeiros 8 linha e 2 goleiros que chegaram
        const draftPoolGoleiros = arrivedGoleiro.slice(0, 2);
        const draftPoolLinha = arrivedLinha.slice(0, 8);
        const draftPool = [...draftPoolGoleiros, ...draftPoolLinha];
        
        els.draftPool.innerHTML = draftPool.length ? draftPool.map(p => playerHtml(p, 'undoArrival', state.draftCompleted)).join('') : '<li class="player-item empty-state">Ninguém chegou ainda</li>';

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
                actionBtn = `<button class="btn-remove" title="Remover do Elenco" onclick="removePlayer('${player.id}')"><i class="fa-solid fa-trash"></i></button>`;
            } else if (action === 'undoConfirm') {
                actionBtn = `<button class="btn-remove" title="Desfazer Confirmação" onclick="undoConfirm('${player.id}')"><i class="fa-solid fa-xmark"></i></button>`;
            } else if (action === 'undoArrival') {
                actionBtn = `<button class="btn-remove" title="Desfazer Chegada" onclick="undoArrival('${player.id}')"><i class="fa-solid fa-xmark"></i></button>`;
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
    
    function playerCheckboxHtml(player) {
        return `
            <li class="player-item checkbox-item" style="padding: 0;">
                <label style="display: flex; align-items: center; width: 100%; cursor: pointer; padding: 12px 15px;">
                    <input type="checkbox" value="${player.id}" class="confirm-checkbox glass-checkbox" style="margin-right: 15px; width: 22px; height: 22px; cursor: pointer;">
                    <div class="player-info">
                        <span class="player-name">${player.name}</span>
                        <span class="player-role-badge ${player.role}">${player.role.toUpperCase()}</span>
                    </div>
                </label>
            </li>
        `;
    }

    function playerArrivalHtml(player) {
        return `
            <li class="player-item">
                <div class="player-info">
                    <span class="player-name">${player.name}</span>
                    <span class="player-role-badge ${player.role}">${player.role.toUpperCase()}</span>
                </div>
                <button class="primary-btn accent" title="Marcar Chegada" onclick="markArrival('${player.id}')" style="padding: 6px 16px; font-size: 0.9rem; border-radius: 8px;"><i class="fa-solid fa-map-pin"></i> Chegou</button>
            </li>
        `;
    }

    function renderAll() {
        els.date.value = state.matchDate;
        els.time.value = state.matchTime;
        renderPlayers();
        renderConfirmations();
        renderArrivals();
    }
});
