// *** CONFIGURAÇÃO ***
// Cole a URL do seu Google Apps Script aqui entre as aspas:
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEJiV9ugH1_43ry-qoxz10DD96vZnNY7XdB_HSq6_oPVSLBXelRKmDJnQsnsuGOLjH/exec";

// *** DETECÇÃO DE DISPOSITIVO ***
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return "Tablet";
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return "Smartphone";
    }
    return "Desktop";
}

let deputies = [];
let userVotes = {};
let sessionId = generateSessionId(); // Identificador único da sessão

// *** SISTEMA DE RASTREAMENTO DE TEMPO ***
// Armazena timestamps de cada fase para calcular duração
const phaseTimestamps = {
    app_loaded: null,           // Quando o app carregou
    inicio: null,               // Clicou em "Iniciar"
    uf_selecionada: null,       // Selecionou UF/ideologia/partido
    votacao_iniciada: null,     // Primeira votação
    votacao_completa: null,     // Completou votações
    demografica_completa: null  // Completou pesquisa
};

let userProfile = {
    uf: "",
    ideologia: "", // Mudado de 4 para vazio (default explícito exigido)
    partido: "",
    sexo: "",
    escolaridade: "",
    idade: "",
    avaliacaoCongresso: "" // Mudado de 5 para vazio
};
let currentPautaIndex = 0;
let isVoting = false;

// ... (Restante do código)

const PAUTAS = [
    {
        id: "reduz_pena",
        titulo: "PL da Dosimetria",
        resumo: "A Câmara dos Deputados aprovou o projeto de lei que reduz penas de pessoas condenadas pelos atos antidemocráticos de 8 de janeiro de 2023 e pela tentativa de golpe de Estado, como o ex-presidente Jair Bolsonaro.",
        link: "https://www.camara.leg.br/noticias/1231523-deputados-aprovam-texto-base-de-projeto-que-reduz-penas-dos-condenados-pelo-8-de-janeiro-acompanhe/"
    },
    {
        id: "PEC_blindagem",
        titulo: "PEC da Blindagem",
        resumo: "A Câmara dos Deputados aprovou, em 16/07/25, a Proposta de Emenda à Constituição que prevê autorização da Câmara ou do Senado para que o Supremo Tribunal Federal possa processar deputados ou senadores.",
        link: "https://www.camara.leg.br/noticias/1200769-camara-aprova-em-2-turno-o-texto-base-da-pec-das-prerrogativas"
    },
    {
        id: "licenciamento_ambiental",
        titulo: "Licenciamento Ambiental",
        resumo: "A Câmara dos Deputados aprovou, em julho de 2025, o Projeto de Lei 2.159/2021, que flexibiliza as regras do licenciamento ambiental no Brasil. O texto criou a \"Licença Ambiental Especial\" para projetos considerados estratégicos, permitindo licenciamento simplificado, mesmo com alto potencial de degradação ambiental.",
        link: "https://www.camara.leg.br/noticias/1181164-CAMARA-APROVA-PROJETO-QUE-ALTERA-REGRAS-DE-LICENCIAMENTO-AMBIENTAL"
    },
    {
        id: "reforma_tributaria",
        titulo: "Reforma Tributária",
        resumo: "A Câmara dos Deputados aprovou a reforma tributária em 15/12/23 que simplifica impostos sobre o consumo, prevê fundos para o desenvolvimento regional e para bancar créditos do ICMS até 2032, além de unificar a legislação dos novos tributos.",
        link: "https://www.camara.leg.br/noticias/1027138-camara-conclui-votacao-da-reforma-tributaria-texto-sera-promulgado-na-quarta-feira"
    },
    {
        id: "arcabouco",
        titulo: "Novo Arcabouço Fiscal",
        resumo: "O Regime Fiscal Sustentável, conhecido como Novo Arcabouço Fiscal, foi aprovado em 2023. Ele é um mecanismo de controle do endividamento que substituiu o antigo Teto de Gastos por um regime fiscal sustentável focado no equilíbrio entre arrecadação e despesas do governo federal.",
        link: "https://www.camara.leg.br/internet/agencia/infograficos-html5/novo-arcabouco-fiscal/index.html"
    },
    {
        id: "marco_temporal",
        titulo: "Marco Temporal",
        resumo: "A Câmara dos Deputados aprovou o marco temporal das terras indígenas, projeto que define a demarcação apenas de terras que já eram ocupadas por povos indígenas até a promulgação da Constituição Federal de 1988.",
        link: "https://www.camara.leg.br/noticias/967344-CAMARA-APROVA-PROJETO-DO-MARCO-TEMPORAL-PARA-DEMARCACAO-DAS-TERRAS-INDIGENAS"
    }
];

// Load Data
async function init() {
    // Registra timestamp de carregamento do app
    phaseTimestamps.app_loaded = Date.now();

    try {
        const response = await fetch('data.json');
        deputies = await response.json();

        // CORREÇÃO: Normaliza nomes de partidos (Ex: Republicanos)
        deputies = deputies.map(d => {
            if (d.partido && (d.partido.toUpperCase().includes('REPI') || d.partido.toUpperCase().includes('REPU'))) {
                d.partido = 'REPUBLICANOS';
            }
            return d;
        });
        populateParties(); // Preenche select de partidos
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    // Rola para o topo ao trocar de tela
    window.scrollTo(0, 0);
}

function populateParties() {
    // Extrai partidos únicos e ordena alfabeticamente
    const partidos = [...new Set(deputies.map(d => d.partido))].sort();
    const select = document.getElementById('partido-select');

    select.innerHTML = '<option value="" disabled selected>Escolha um partido</option>';
    select.innerHTML += '<option value="Nenhum">Nenhum</option>';

    partidos.forEach(p => {
        select.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

function populateAgeSelect() {
    const select = document.getElementById('idade-input');
    if (!select) return;

    for (let age = 16; age <= 99; age++) {
        select.innerHTML += `<option value="${age}">${age} anos</option>`;
    }
}


function setupEventListeners() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.onclick = () => {
        trackEvent('inicio', 'Clicou em Iniciar Match');
        showScreen('uf-screen');
    };

    document.getElementById('uf-select').onchange = (e) => {
        userProfile.uf = e.target.value;
        checkStartButton();
    };

    // Listeners para Ideologia (Radio Buttons)
    const ideologiaRadios = document.querySelectorAll('input[name="ideologia"]');
    const ideologiaDisplay = document.getElementById('ideologia-display');

    ideologiaRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            userProfile.ideologia = val;

            let label = "Centro";
            if (val == 1) label = "Extrema-Esquerda";
            if (val == 2) label = "Esquerda";
            if (val == 3) label = "Centro-Esquerda";
            if (val == 4) label = "Centro";
            if (val == 5) label = "Centro-Direita";
            if (val == 6) label = "Direita";
            if (val == 7) label = "Extrema-Direita";

            ideologiaDisplay.textContent = `${val} - ${label}`;

            // Marca que o usuário mexeu (ou simplesmente pelo fato de ter escolhido)
            hasMovedIdeologySlider = true;
            checkStartButton();
        });
    });

    // Listener para Partido
    const partidoSelect = document.getElementById('partido-select');
    if (partidoSelect) {
        partidoSelect.onchange = (e) => {
            userProfile.partido = e.target.value;
            checkStartButton();
        };
    }



    // Listeners para a tela demográfica
    const demographicInputs = ['sexo-input', 'escolaridade-input', 'idade-input'];
    demographicInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onchange = () => {
                if (id === 'sexo-input') userProfile.sexo = el.value;
                if (id === 'escolaridade-input') userProfile.escolaridade = el.value;
                if (id === 'idade-input') userProfile.idade = el.value;
                checkDemographicButton();
            };
        }
    });

    // Listener para nota do congresso na tela demográfica
    const congressoRadios = document.querySelectorAll('input[name="nota-congresso"]');
    congressoRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            userProfile.avaliacaoCongresso = e.target.value;
            checkDemographicButton();
        });
    });

    // Botão "Ver o meu match eleitoral"
    const viewMatchBtn = document.getElementById('view-match-btn');
    if (viewMatchBtn) {
        viewMatchBtn.onclick = () => {
            trackEvent('demografica_completa', 'Respondeu pesquisa demográfica');
            sendDataToSheet(true, false); // Salva dados finais
            calculateResults();
        };
    }

    document.getElementById('uf-confirm-btn').onclick = () => {
        trackEvent('uf_selecionada', `UF:${userProfile.uf} Ideologia:${userProfile.ideologia} Partido:${userProfile.partido}`);
        showScreen('voting-screen');
        renderPauta();
    };

    document.querySelectorAll('.vote-manual-btn').forEach(btn => {
        btn.onclick = () => handleVote(btn.dataset.vote);
    });

    // Keyboard support
    document.onkeydown = (e) => {
        if (document.getElementById('voting-screen').classList.contains('active')) {
            if (e.key === "ArrowRight") handleVote("Sim");
            if (e.key === "ArrowLeft") handleVote("Não");
        }
    };
}

function renderPauta() {
    if (currentPautaIndex >= PAUTAS.length) {
        // Rastreia conclusão das votações
        trackEvent('votacao_completa', `Completou ${PAUTAS.length} votações`);
        // Redireciona para tela demográfica ao invés de ir direto aos resultados
        showScreen('demographic-screen');
        populateAgeSelect(); // Popula o select de idade
        return;
    }

    const pauta = PAUTAS[currentPautaIndex];
    const stack = document.getElementById('vote-stack');
    stack.innerHTML = `
        <div class="vote-card" id="active-card">
            <div class="stamp sim">SIM</div>
            <div class="stamp nao">NÃO</div>
            <span style="font-size:0.7rem; opacity:0.6;">PAUTA ${currentPautaIndex + 1}/${PAUTAS.length}</span>
            <h2 style="margin-top:1rem;">${pauta.titulo}</h2>
            <p>${pauta.resumo}</p>
            
            <a href="${pauta.link}" target="_blank" class="saiba-mais">Saiba mais sobre este tema</a>
            
            <div style="margin: 1.5rem 0; padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid var(--accent-color);">
                <p style="font-weight: 800; color: var(--accent-color); font-size: 1.1rem; margin-bottom: 0.5rem; text-transform: uppercase;">
                    VOCÊ É FAVORÁVEL A ESSA PROPOSTA?
                </p>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.9rem;">
                    <span style="color: var(--danger-color);">⬅️ NÃO (Esquerda)</span>
                    <span style="color: var(--success-color);">SIM (Direita) ➡️</span>
                </div>
            </div>
        </div>
    `;

    initSwipe();
}

function handleVote(vote) {
    if (isVoting) return; // Debounce anti-duplo clique
    isVoting = true;

    const pauta = PAUTAS[currentPautaIndex];
    userVotes[pauta.id] = vote;

    // Rastreia primeira votação
    if (currentPautaIndex === 0) {
        trackEvent('votacao_iniciada', 'Primeira votação realizada');
    }

    const card = document.getElementById('active-card');
    const direction = vote === "Sim" ? 1000 : -1000;
    card.style.transition = "transform 0.5s ease";
    card.style.transform = `translateX(${direction}px) rotate(${direction / 20}deg)`;

    setTimeout(() => {
        currentPautaIndex++;
        renderPauta();
        isVoting = false; // Destrava para o próximo voto
    }, 300);
}

function initSwipe() {
    const card = document.getElementById('active-card');
    let startX = 0;
    let currentX = 0;

    card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });

    card.addEventListener('touchmove', (e) => {
        // Previne scroll da tela enquanto arrasta o card
        e.preventDefault();
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        updateCardTransform(card, diff);
    });

    card.addEventListener('touchend', (e) => {
        const diff = currentX - startX;
        finishSwipe(card, diff);
    });

    // Mouse support
    card.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        card.style.cursor = 'grabbing';
        card.addEventListener('mousemove', onMouseMove);
    });

    const onMouseMove = (e) => {
        currentX = e.clientX;
        const diff = currentX - startX;
        updateCardTransform(card, diff);
    };

    window.addEventListener('mouseup', (e) => {
        if (!startX) return;
        card.removeEventListener('mousemove', onMouseMove);
        card.style.cursor = 'grab';
        const diff = currentX - startX;
        finishSwipe(card, diff);
        startX = 0;
        currentX = 0;
    });
}

function updateCardTransform(card, diff) {
    const rotation = diff / 20;
    card.style.transform = `translateX(${diff}px) rotate(${rotation}deg)`;

    const simStamp = card.querySelector('.stamp.sim');
    const naoStamp = card.querySelector('.stamp.nao');

    if (diff > 50) {
        card.style.boxShadow = "0 10px 50px rgba(0, 230, 118, 0.5)";
        simStamp.style.opacity = Math.min(diff / 150, 1);
        naoStamp.style.opacity = 0;
    } else if (diff < -50) {
        card.style.boxShadow = "0 10px 50px rgba(255, 82, 82, 0.5)";
        naoStamp.style.opacity = Math.min(Math.abs(diff) / 150, 1);
        simStamp.style.opacity = 0;
    } else {
        card.style.boxShadow = "";
        simStamp.style.opacity = 0;
        naoStamp.style.opacity = 0;
    }
}

function finishSwipe(card, diff) {
    if (diff > 100) handleVote("Sim");
    else if (diff < -100) handleVote("Não");
    else {
        card.style.transform = "";
        card.style.transition = "transform 0.2s";
        card.style.boxShadow = "";
        const simStamp = card.querySelector('.stamp.sim');
        const naoStamp = card.querySelector('.stamp.nao');
        simStamp.style.opacity = 0;
        naoStamp.style.opacity = 0;
    }
}

// Flag para garantir movimento
let hasMovedIdeologySlider = false;

function checkStartButton() {
    const btn = document.getElementById('uf-confirm-btn');

    // UF, Ideologia e Partido são obrigatórios
    const hasUF = userProfile.uf !== "";
    const hasIdeologia = userProfile.ideologia !== "";
    const hasPartido = userProfile.partido !== "";

    btn.disabled = !(hasUF && hasIdeologia && hasPartido);
}

function calculateResults() {
    // Não salva mais dados parciais aqui - salvamento ocorre apenas após pesquisa demográfica
    showScreen('results-screen');
    const filtered = deputies.filter(d => d.uf === userProfile.uf);

    const scores = filtered.map(dep => {
        let matches = 0;

        PAUTAS.forEach(p => {
            const userVote = userVotes[p.id];
            const depVote = dep.votos[p.id];

            // Considera match apenas se deputado votou Sim ou Não e coincidiu com usuário
            // A divisão será sempre por 6 (PAUTAS.length), evitando distorções
            if ((depVote === "Sim" || depVote === "Não") && userVote === depVote) {
                matches++;
            }
        });

        // Divisão pelo total de pautas (6)
        const pct = Math.round((matches / PAUTAS.length) * 100);
        return { ...dep, pct };
    });

    scores.sort((a, b) => b.pct - a.pct);

    // Salva scores globalmente para uso em shareResults()
    window.matchScores = scores;

    const container = document.getElementById('ranking-container');
    container.innerHTML = `
        <p style="text-align:center; font-size:0.9rem; margin-bottom:1rem; color:var(--text-muted);">
            Clique no deputado para ver o comparativo detalhado
        </p>
    ` + scores.slice(0, 20).map((dep, idx) => `
        <div class="ranking-item" style="cursor:pointer;" onclick="showDeputyDetail('${dep.id}', ${dep.pct})">
            <div class="deputy-avatar">
                <i class="fas fa-user fallback-icon"></i>
                <img src="${dep.foto}" 
                     onerror="this.style.opacity='0'">
            </div>
            <div class="dep-info">
                <strong>${dep.nome}</strong><br>
                <span style="font-size:0.8rem; opacity:0.7;">${dep.partido} - ${dep.uf}</span>
            </div>
            <div class="match-pct">${dep.pct}%</div>
        </div>
    `).join('');

    const topMatch = scores[0];
    const bottomMatch = scores[scores.length - 1]; // Pega o último da lista (menor afinidade)
}


function showDeputyDetail(depId, matchPct) {
    const dep = deputies.find(d => d.id == depId);
    if (!dep) return;

    const modal = document.getElementById('dep-modal');
    const content = document.getElementById('modal-content');

    let votesHtml = PAUTAS.map(p => {
        const depVote = dep.votos[p.id] || "N/A";
        const userVote = userVotes[p.id];
        const isMatch = depVote === userVote;

        let color, borderColor;

        if (depVote !== "Sim" && depVote !== "Não") {
            // Voto neutro/ausente
            color = 'var(--text-muted)';
            borderColor = 'rgba(255,255,255,0.2)';
        } else if (isMatch) {
            color = 'var(--success-color)';
            borderColor = 'var(--success-color)';
        } else {
            color = 'var(--danger-color)';
            borderColor = 'var(--danger-color)';
        }

        return `
            <div style="margin-bottom:1rem; padding:0.8rem; background:rgba(255,255,255,0.05); border-radius:10px; border-left:4px solid ${borderColor}; text-align:left;">
                <div style="font-size:0.9rem; font-weight:bold; margin-bottom:0.3rem;">${p.titulo}</div>
                <div style="font-size:0.8rem; opacity:0.8;">
                    Deputado: <span style="font-weight:bold; color:${color}">${depVote}</span> | 
                    Você: <span style="opacity:0.7;">${userVote}</span>
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div style="text-align:center; margin-bottom:2rem;">
            <div style="width:100px; height:100px; margin:0 auto 1rem auto; border-radius:50%; overflow:hidden; background:#eee; position:relative; border:3px solid var(--accent-color);">
                <i class="fas fa-user fallback-icon" style="font-size:3rem;"></i>
                <img src="${dep.foto}" 
                     style="width:100%; height:100%; object-fit:cover; object-position:top; position:absolute; top:0; left:0; z-index:2; display:block;" 
                     onerror="this.style.opacity='0'">
            </div>
            <h2 style="margin:0;">${dep.nome}</h2>
            <div style="opacity:0.7;">${dep.partido} - ${dep.uf}</div>
            <div style="font-size:1.5rem; font-weight:bold; color:var(--success-color); margin-top:0.5rem;">${matchPct}% de Match</div>
        </div>
        <div style="margin-top:1rem;">
            <h3 style="font-size:1rem; margin-bottom:1rem; text-align:left;">Detalhamento dos Votos:</h3>
            ${votesHtml}
        </div>
    `;

    modal.style.display = 'block';
}


function shareSocial(network) {
    const text = encodeURIComponent("Descubra seu Match Eleitoral! Compare seus votos com os deputados federais.");
    const url = encodeURIComponent(window.location.href);
    let shareUrl = "";

    // Rastreia compartilhamento por rede social
    trackEvent(`compartilhamento_url_${network}`, `Clicou para compartilhar no ${network}`);

    switch (network) {
        case 'whatsapp':
            shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
        case 'bluesky':
            // Bluesky intent not standard yet, just open app or site
            shareUrl = `https://bsky.app/intent/compose?text=${text}%20${url}`;
            break;
    }

    if (shareUrl) window.open(shareUrl, '_blank');
}

// Função para copiar link do site
function copyLink() {
    const url = window.location.href;

    // Rastreia clique no botão de copiar link
    trackEvent('compartilhamento_url_copy', 'Clicou para copiar link');

    // Tenta copiar para área de transferência
    navigator.clipboard.writeText(url).then(() => {
        // Feedback visual de sucesso
        alert('✅ Link copiado!\n\nCole onde quiser para compartilhar o Match Eleitoral.');
    }).catch(err => {
        // Fallback se clipboard API não funcionar
        console.error('Erro ao copiar:', err);
        // Mostra o link para o usuário copiar manualmente
        prompt('Copie este link:', url);
    });
}

// Função para compartilhar resultados em diferentes redes sociais
async function shareResults(network) {
    // Precisa ter scores disponível (variável global criada em calculateResults)
    if (!window.matchScores || window.matchScores.length === 0) {
        alert('Erro: Resultados não disponíveis');
        return;
    }

    const scores = window.matchScores;
    const topMatch = scores[0];
    const bottomMatch = scores[scores.length - 1];

    // Texto com emojis para melhor engajamento
    const baseText = `Olha que interessante! 💡 Esse app calcula o quanto eu e uma lista de deputados temos de afinidade. 🧑‍⚖️🏛️\n\nMinha maior afinidade foi de ${topMatch.pct}% com ${topMatch.nome} (${topMatch.partido}) e a menor ${bottomMatch.pct}% com ${bottomMatch.nome} (${bottomMatch.partido}). 😲\n\nFaça o teste: ${window.location.href}`;

    // Rastreia compartilhamento
    trackEvent(`compartilhamento_resultado_${network}`, `Clicou para compartilhar resultado no ${network}`);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Para "copiar", apenas copia o texto
    if (network === 'copy') {
        navigator.clipboard.writeText(baseText).then(() => {
            alert('✅ Resultado copiado!\n\nCole onde quiser para compartilhar.');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            prompt('Copie este texto:', baseText);
        });
        return;
    }

    // Para mobile com WhatsApp, tenta compartilhar com imagem
    if (isMobile && network === 'whatsapp') {
        try {
            // Mostra mensagem de processamento
            const originalBody = document.body.innerHTML;
            const loadingDiv = document.createElement('div');
            loadingDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white;';
            loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:3rem; margin-bottom:1rem;"></i><p style="font-size:1.2rem;">Gerando imagem...</p>';
            document.body.appendChild(loadingDiv);

            // Prepara o card com os top 5
            const shareList = document.getElementById('share-list');
            shareList.innerHTML = scores.slice(0, 5).map((dep, idx) => `
                <div style="display:flex; align-items:center; background:rgba(255,255,255,0.1); padding:15px; border-radius:25px; border-left:10px solid ${idx === 0 ? '#00e676' : '#00d2ff'};">
                    <div style="width:110px; height:110px; border-radius:50%; overflow:hidden; border:4px solid #fff; margin-right:25px; flex-shrink:0;">
                        <img src="https://wsrv.nl/?url=${encodeURIComponent(dep.foto)}&w=200&h=200&fit=cover" style="width:100%; height:100%; object-fit:cover;" crossorigin="anonymous">
                    </div>
                    <div style="flex:1;">
                        <h2 style="font-size:2.2rem; margin-bottom:5px;">${dep.nome}</h2>
                        <p style="font-size:1.6rem; opacity:0.8;">${dep.partido} - ${dep.uf}</p>
                    </div>
                    <div style="font-size:3rem; font-weight:900; color:${idx === 0 ? '#00e676' : '#00d2ff'};">
                        ${dep.pct}%
                    </div>
                </div>
            `).join('');

            // Gera a imagem
            const canvas = await html2canvas(document.querySelector("#share-card"), {
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                allowTaint: true
            });

            // Converte para blob
            canvas.toBlob(async (blob) => {
                const file = new File([blob], "match-eleitoral-resultado.png", { type: "image/png" });

                // Remove loading
                document.body.removeChild(loadingDiv);

                // Tenta compartilhar com imagem
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Meu Match Eleitoral',
                            text: baseText
                        });
                    } catch (e) {
                        if (e.name !== 'AbortError') {
                            console.error(e);
                            // Fallback: abre WhatsApp com texto
                            window.open(`https://wa.me/?text=${encodeURIComponent(baseText)}`, '_blank');
                        }
                    }
                } else {
                    // Fallback: abre WhatsApp com texto
                    window.open(`https://wa.me/?text=${encodeURIComponent(baseText)}`, '_blank');
                }
            }, 'image/png');

        } catch (err) {
            console.error(err);
            // Fallback: abre WhatsApp com texto
            window.open(`https://wa.me/?text=${encodeURIComponent(baseText)}`, '_blank');
        }
        return;
    }

    // Para outras redes ou desktop, compartilha apenas texto/URL
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(baseText);
    let shareUrl = "";

    switch (network) {
        case 'whatsapp':
            shareUrl = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                ? `https://wa.me/?text=${text}`
                : `https://web.whatsapp.com/send?text=${text}`;
            break;
        case 'twitter':
            // Twitter tem limite de caracteres
            const twitterText = encodeURIComponent(`Minha maior afinidade foi de ${topMatch.pct}% com ${topMatch.nome} (${topMatch.partido}). Faça o teste:`);
            shareUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${url}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
        case 'bluesky':
            shareUrl = `https://bsky.app/intent/compose?text=${text}`;
            break;
    }

    if (shareUrl) {
        console.log('Compartilhando:', network, shareUrl);
        window.open(shareUrl, '_blank');
    }
}


// Função para verificar se todas as perguntas demográficas foram respondidas
function checkDemographicButton() {
    const btn = document.getElementById('view-match-btn');
    if (!btn) return;

    const hasSexo = userProfile.sexo !== "";
    const hasEscolaridade = userProfile.escolaridade !== "";
    const hasIdade = userProfile.idade !== "";
    const hasNota = userProfile.avaliacaoCongresso !== "";

    btn.disabled = !(hasSexo && hasEscolaridade && hasIdade && hasNota);
}

// Inicializa
setupEventListeners();
init();

function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// *** SISTEMA DE MÉTRICAS ***

// Função auxiliar para obter fase anterior
function getPreviousPhase(currentPhase) {
    const phaseOrder = [
        'app_loaded',
        'inicio',
        'uf_selecionada',
        'votacao_iniciada',
        'votacao_completa',
        'demografica_completa'
    ];

    const currentIndex = phaseOrder.indexOf(currentPhase);
    return currentIndex > 0 ? phaseOrder[currentIndex - 1] : null;
}

function trackEvent(eventType, details = '') {
    if (GOOGLE_SCRIPT_URL.includes("COLE_AQUI")) return;

    // Registrar timestamp desta fase
    const now = Date.now();
    if (phaseTimestamps.hasOwnProperty(eventType)) {
        phaseTimestamps[eventType] = now;
    }

    // Calcular tempo desde início do app (em segundos)
    const timeFromStart = phaseTimestamps.app_loaded
        ? Math.round((now - phaseTimestamps.app_loaded) / 1000)
        : 0;

    // Calcular tempo desde fase anterior (em segundos)
    const previousPhase = getPreviousPhase(eventType);
    const timeSincePrevious = previousPhase && phaseTimestamps[previousPhase]
        ? Math.round((now - phaseTimestamps[previousPhase]) / 1000)
        : 0;

    // Calcular tempo total (só para fase final)
    const totalTime = eventType === 'demografica_completa' ? timeFromStart : null;

    const eventData = {
        event_type: eventType,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        details: details,
        uf: userProfile.uf || '',
        ideologia: userProfile.ideologia || '',
        partido: userProfile.partido || '',
        time_from_start_seconds: timeFromStart,
        time_since_previous_seconds: timeSincePrevious,
        total_time_seconds: totalTime,
        device_type: getDeviceType() // NOVO: Tipo de dispositivo
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
    }).catch(err => console.error('Erro ao rastrear evento:', err));

    console.log('📊 Evento rastreado:', eventType, details, `| Tempo desde início: ${timeFromStart}s | Tempo desde anterior: ${timeSincePrevious}s`);
}

function sendDataToSheet(isFinal, silent = false) {
    if (GOOGLE_SCRIPT_URL.includes("COLE_AQUI")) return;

    const dataToSend = {
        session_id: sessionId,
        etapa: isFinal ? "final" : "parcial",
        uf: userProfile.uf,
        ideologia: userProfile.ideologia,
        partido: userProfile.partido,
        sexo: isFinal ? (userProfile.sexo || "") : "",
        escolaridade: isFinal ? (userProfile.escolaridade || "") : "",
        idade: isFinal ? (userProfile.idade || "") : "",
        avaliacaoCongresso: isFinal ? (userProfile.avaliacaoCongresso || "") : "",

        // Votos
        Q1_Dosimetria: userVotes['reduz_pena'] || "N/A",
        Q2_PEC_Blindagem: userVotes['PEC_blindagem'] || "N/A",
        Q3_LicenciamentoAmb: userVotes['licenciamento_ambiental'] || "N/A",
        Q4_ReformaTrib: userVotes['reforma_tributaria'] || "N/A",
        Q5_ArcaboucoFisc: userVotes['arcabouco'] || "N/A",
        Q6_MarcoTemporal: userVotes['marco_temporal'] || "N/A"
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
    }).then(() => {
        if (isFinal && !silent) {
            console.log("Dados demográficos salvos com sucesso.");
        } else if (silent) {
            console.log("Auto-save successful");
        }
    }).catch(err => console.error("Erro no envio:", err));
}

