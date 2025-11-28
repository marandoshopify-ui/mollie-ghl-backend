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
  apiKey: "test_mAp53HbnD6hcPuze3bNtu7qBNjSHst", // <<--- METTI QUI LA TUA CHIAVE LIVE
});

// ===== CONFIG SERVIZI =====
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

// ===== ROUTE CREA PAGAMENTO =====
app.post("/create-payment", async (req, res) => {
  try {
    const selectedServices = req.body.services || [];
    const user = req.body.user || {}; // nome, email, telefono

    if (!Array.isArray(selectedServices) || selectedServices.length === 0) {
      return res.status(400).json({ error: true, message: "Nessun servizio selezionato" });
    }

    // Somma prezzi lato server (sicuro)
    let total = 0;
    let serviceNames = [];

    for (const code of selectedServices) {
      const srv = SERVICES[code];
      if (!srv) continue;

      total += parseFloat(srv.price);
      serviceNames.push(srv.name);
    }

    if (serviceNames.length === 0) {
      return res.status(400).json({ error: true, message: "Servizi non validi" });
    }

    const amount = total.toFixed(2);
    const description = serviceNames.join(", ");

    // CREA PAGAMENTO MOLLIE
    const payment = await mollieClient.payments.create({
      amount: {
        currency: "EUR",
        value: amount,
      },
      description,
      redirectUrl: "https://tiktok-boost.com/pagamento-completato",
      webhookUrl: "https://mollie-ghl-backend.onrender.com/webhook", // IMPORTANTISSIMO
      metadata: {
        services: selectedServices,
        user,
      },
    });

    return res.json({ success: true, checkoutUrl: payment.getCheckoutUrl() });

  } catch (err) {
    console.error("Errore create-payment:", err);
    return res.status(500).json({ error: true, message: "Errore creazione pagamento" });
  }
});

// ===== WEBHOOK PAGAMENTO COMPLETATO =====
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body.id;
    const payment = await mollieClient.payments.get(paymentId);

    if (payment.status === "paid") {
      const meta = payment.metadata;

      // INVIA DATI A GHL TRAMITE WEBHOOK
      await fetch("YOUR_GHL_WEBHOOK_URL_HERE", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: meta.user.full_name,
          email: meta.user.email,
          phone: meta.user.phone,
          purchased_services: meta.services,
          amount: payment.amount.value,
        }),
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Errore webhook:", err);
    res.sendStatus(500);
  }
});

// ===== AVVIO SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server attivo sulla porta", PORT));
