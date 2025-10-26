const express = require('express');
const { StremioAPIStore } = require('stremio-api-client');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
// Useremo la porta 3000 come standard per le app Node.js
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// Funzione principale per ottenere e ordinare gli add-on
async function getAndSortAddons(email, password) {
    if (!email || !password) {
        throw new Error("Email o Password mancanti.");
    }
    
    // --- INIZIO MODIFICA PER PROXY ---
    const proxyUrl = process.env.PROXY_URL; // Leggiamo l'URL del proxy dalle variabili d'ambiente
    if (!proxyUrl) {
        console.warn("ATTENZIONE: PROXY_URL non impostato. Le richieste verranno fatte direttamente.");
    }
    
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
    
    const apiStore = new StremioAPIStore({
        endpoint: 'https://api.strem.io',
        // Passiamo l'agent del proxy alle opzioni di fetch
        fetchOptions: {
            agent: agent
        },
        storage: { 
            getJSON: () => null, 
            setJSON: () => {} 
        }
    });
    // --- FINE MODIFICA PER PROXY ---

    console.log(`Tentativo di accesso per: ${email} tramite proxy...`);
    await apiStore.login({ email, password });
    
    console.log('Login effettuato. Recupero add-on...');
    await apiStore.pullAddonCollection();

    const addons = apiStore.addons ? apiStore.addons.addons : [];
    if (!Array.isArray(addons)) {
        console.log("Nessun add-on trovato o formato dati non valido.");
        return [];
    }

    console.log(`Trovati ${addons.length} add-on.`);
    const sortedAddons = addons.sort((a, b) => {
        const nameA = a.manifest.name.toLowerCase();
        const nameB = b.manifest.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    return sortedAddons;
}

// ... il resto del file (le rotte GET e POST) rimane identico a prima ...

// Pagina Iniziale (GET /)
app.get('/', (req, res) => {
    // Stile CSS e modulo HTML
    const htmlStyle = `body { font-family: sans-serif; display: grid; place-items: center; min-height: 80vh; background-color: #f4f4f4; } form { background: #fff; border: 1px solid #ccc; padding: 25px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); } div { margin-bottom: 15px; } label { display: block; margin-bottom: 5px; font-weight: bold; } input[type='email'], input[type='password'] { width: 300px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; } button { width: 100%; padding: 10px; background-color: #4B0082; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; } button:hover { background-color: #3a0063; } h1 { text-align: center; }`;
    const htmlForm = `<html><head><title>Accesso Stremio</title><style>${htmlStyle}</style></head><body><form action="/addons" method="POST"><h1>Accedi al tuo account Stremio</h1><div><label for="email">Email:</label><input type="email" id="email" name="email" required></div><div><label for="password">Password:</label><input type="password" id="password" name="password" required></div><button type="submit">Mostra Add-on Ordinati</button></form></body></html>`;
    res.send(htmlForm);
});

// Pagina Risultati (POST /addons)
app.post('/addons', async (req, res) => {
    const { email, password } = req.body;
    try {
        const sortedAddons = await getAndSortAddons(email, password);
        let html = `<html><head><title>Add-on Stremio Ordinati</title><style>body { font-family: sans-serif; padding: 20px; } ul { list-style-type: none; padding: 0; } li { background: #f9f9f9; border: 1px solid #eee; padding: 10px 15px; margin-bottom: 8px; border-radius: 5px; } a { display: block; margin-top: 20px; } .no-addons { font-style: italic; color: #555; }</style></head><body><h1>I Tuoi Add-on Stremio (Ordinati per Nome)</h1>`;
        if (sortedAddons.length > 0) {
            html += '<ul>';
            sortedAddons.forEach(addon => {
                html += `<li><strong>${addon.manifest.name}</strong><p>${addon.manifest.description || 'Nessuna descrizione'}</p></li>`;
            });
            html += '</ul>';
        } else {
            html += '<p class="no-addons">Nessun add-on trovato per questo account.</p>';
        }
        html += `<a href="/">Torna al login</a></body></html>`;
        res.send(html);
    } catch (error) {
        console.error("--- ERRORE DETTAGLIATO DAL LOGIN ---");
        console.error(error);
        console.error("------------------------------------");
        let userMessage = "Impossibile effettuare il login. Controlla le tue credenziali e riprova.";
        if (error && error.message) { userMessage += `<br><br><i>Dettaglio tecnico: ${error.message}</i>`; }
        res.status(401).send(`<html><head><title>Errore</title><style>body {font-family: sans-serif; padding: 20px;}</style></head><body><h1>Errore di Accesso</h1><p>${userMessage}</p><br><a href="/">Torna al login</a></body></html>`);
    }
});

app.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
