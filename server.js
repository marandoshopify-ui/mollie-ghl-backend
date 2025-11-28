const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// ⬇️ METTI QUI LA TUA MOLLIE API KEY (test_ per test, live_ per produzione)
const MOLLIE_API_KEY = "test_VF6ueTaFBBtR9NtUA74F4K2s35e8gj";

// Webhook GHL (Inbound Webhook del workflow)
const GHL_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/PtmpyXxZAdcEhKIEw8cX/webhook-trigger/bde9a7a3-9f68-49c9-bc50-713c55303b2b";

// Listino servizi (CODICE -> nome + prezzo)
const SERVICES = {
  setup: { name: "TikTok Shop MasterClass", price: "47.00" },
  ads:   { name: "TOP 10 Prodotti - Dicembre", price: "9.90" },
  call:  { name: "Account TikTok Pre-Configurato", price: "19.90" }
};

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/create-payment", async (req, res) => {
  try {
    const selectedServices = req.body.services || []; // array di codici: ["setup","ads","call"]

    // 👇 dati utente dal form (GHL)
    const name  = req.body.name  || "";
    const email = req.body.email || "";
    const phone = req.body.phone || "";

    if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
      return res.status(400).json({ error: true, message: "Nessun servizio selezionato" });
    }

    // Calcolo totale lato server
    let total = 0;
    const serviceNames = [];

    for (const code of selectedServices) {
      const srv = SERVICES[code];
      if (!srv) continue; // se arriva qualcosa di strano lo ignoro

      total += parseFloat(srv.price);
      serviceNames.push(srv.name);
    }

    if (serviceNames.length === 0) {
      return res.status(400).json({ error: true, message: "Servizi non validi" });
    }

    const amount = total.toFixed(2); // es: "76.80"
    const planDescription = serviceNames.join(", ");

    const payload = {
      amount: {
        currency: "EUR",
        value: amount
      },
      description: `Pagamento servizi: ${planDescription}`,
      redirectUrl: "https://tiktok-boost.com/thank-you-page-page", // tua thank-you page GHL
      // 👇 QUI Mollie chiamerà il tuo server quando cambia lo stato del pagamento
      webhookUrl: "https://mollie-ghl-backend.onrender.com/webhook-mollie",
      metadata: {
        services: selectedServices,
        serviceNames,
        source: "GHL",
        user: {
          name,
          email,
          phone
        }
      }
    };

    const response = await axios.post(
      "https://api.mollie.com/v2/payments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${MOLLIE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("Errore creando pagamento Mollie:", err.response?.data || err.message);
    res.status(500).json({
      error: true,
      message: "Errore nel creare il pagamento",
      details: err.response?.data || err.message
    });
  }
});

// 🔔 WEBHOOK CHIAMATO DA MOLLIE QUANDO IL PAGAMENTO CAMBIA STATO
app.post("/webhook-mollie", async (req, res) => {
  try {
    const paymentId = req.body.id; // Mollie manda id=tr_xxx nel body (form-urlencoded)

    if (!paymentId) {
      console.error("Webhook Mollie senza payment id");
      return res.status(400).send("Missing payment ID");
    }

    // Recuperiamo i dettagli del pagamento da Mollie
    const mollieRes = await axios.get(
      `https://api.mollie.com/v2/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MOLLIE_API_KEY}`
        }
      }
    );

    const payment = mollieRes.data;

    // Rispondiamo SUBITO a Mollie (così non va in timeout)
    res.send("ok");

    // Ci interessa solo se è pagato
    if (payment.status !== "paid") {
      console.log("Pagamento non paid, status:", payment.status);
      return;
    }

    const meta = payment.metadata || {};
    const user = meta.user || {};

    // Payload che inviamo al Webhook GHL
    const ghlPayload = {
      full_name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      services: meta.serviceNames || meta.services || [],
      amount: payment.amount?.value || "",
      currency: payment.amount?.currency || "EUR",
      mollie_id: payment.id,
      status: payment.status
    };

    try {
      await axios.post(GHL_WEBHOOK_URL, ghlPayload, {
        headers: { "Content-Type": "application/json" }
      });
      console.log("Dati inviati a GHL webhook con successo");
    } catch (err) {
      console.error("Errore inviando dati a GHL:", err.response?.data || err.message);
    }

  } catch (err) {
    console.error("Errore nel webhook Mollie:", err.response?.data || err.message);
    // Mollie ha già ricevuto "ok", quindi non serve altro
  }
});

app.get("/", (req, res) => {
  res.send("Mollie-GHL backend è attivo 🚀");
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
