const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { createMollieClient } = require("@mollie/api-client");

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===== MOLLIE CLIENT =====
const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY, // test_mAp53HbnD6hcPuze3bNtu7qBNjSHst
});

// ===== CONFIG SERVIZI =====
// I prezzi "reali" sono QUI, non fidarti mai di quelli che arrivano dal browser
const SERVICES = {
  setup: {
    name: "TikTok Shop MasterClass",
    price: "47.00",
  },
  ads: {
    name: "TOP 10 Prodotti – novembre",
    price: "9.90",
  },
  call: {
    name: "Account TikTok Pre-Configurato",
    price: "19.90",
  },
};

// ===== ROTTA DI TEST =====
app.get("/", (req, res) => {
  res.send("Mollie GHL backend attivo ✅");
});

// ===== CREA PAGAMENTO =====
app.post("/create-payment", async (req, res) => {
  try {
    const { services, name, email, phone } = req.body;

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: true, message: "Nessun servizio selezionato" });
    }

    // Calcolo totale e nomi servizi
    let total = 0;
    const serviceNames = [];

    for (const code of services) {
      const srv = SERVICES[code];
      if (!srv) continue;
      total += parseFloat(srv.price);
      serviceNames.push(srv.name);
    }

    if (serviceNames.length === 0) {
      return res.status(400).json({ error: true, message: "Servizi non validi" });
    }

    const amount = total.toFixed(2); // es. "76.80"
    const planDescription = serviceNames.join(", ");

    // Creazione pagamento Mollie
    const payment = await mollieClient.payments.create({
      amount: {
        value: amount,
        currency: "EUR",
      },
      description: planDescription,
      redirectUrl: process.env.MOLLIE_REDIRECT_URL,
      webhookUrl: "https://mollie-ghl-backend.onrender.com/webhook-mollie",
      metadata: {
        services: serviceNames,
        name,
        email,
        phone,
      },
    });

    // Ritorniamo l'intero oggetto payment (contiene _links.checkout.href)
    res.json(payment);
  } catch (err) {
    console.error("Errore create-payment:", err);
    res.status(500).json({ error: true, message: "Errore interno nella creazione del pagamento" });
  }
});

// ===== WEBHOOK MOLLIE -> GHL WEBHOOK =====
app.post(
  "/webhook-mollie",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    const paymentId = req.body.id;

    try {
      // Recupera il pagamento da Mollie
      const payment = await mollieClient.payments.get(paymentId);

      // Rispondiamo SUBITO a Mollie
      res.status(200).send("ok");

      if (payment.status !== "paid") {
        return; // ci interessa solo quando è pagato
      }

      const meta = payment.metadata || {};

      const payload = {
        name: meta.name,
        email: meta.email,
        phone: meta.phone,
        services: meta.services,
        amount: payment.amount?.value,
        currency: payment.amount?.currency,
        mollieId: payment.id,
        status: payment.status,
      };

      const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL;

      if (!ghlWebhookUrl) {
        console.warn("⚠️ GHL_WEBHOOK_URL non configurato nelle Environment Variables di Render");
        return;
      }

      // Invia i dati al webhook di GHL (Inbound Webhook del workflow)
      await fetch(ghlWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Errore nel webhook Mollie:", err);
      // Mollie ha già ricevuto 200, quindi non serve altro
    }
  }
);

// ===== AVVIO SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server in ascolto sulla porta", PORT);
});
