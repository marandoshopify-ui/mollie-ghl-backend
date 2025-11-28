const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// ⬇️ METTI QUI LA TUA MOLLIE API KEY (test_ per test, live_ per produzione)
const MOLLIE_API_KEY = "test_mAp53HbnD6hcPuze3bNtu7qBNjSHst";

// Listino servizi (CODICE -> nome + prezzo)
const SERVICES = {
  setup: { name: "TikTok Shop MasterClass", price: “47.00" },
  ads:   { name: "TOP 10 Prodotti – novembre", price: “9.90" },
  call:  { name: "Account TikTok Pre-Configurato", price: "19.90" }
};

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/create-payment", async (req, res) => {
  try {
    const selectedServices = req.body.services || []; // array di codici: ["setup","ads"]

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

    const amount = total.toFixed(2); // es: "394.00"
    const planDescription = serviceNames.join(", ");

    const payload = {
      amount: {
        currency: "EUR",
        value: amount
      },
      description: `Pagamento servizi: ${planDescription}`,
      redirectUrl: "https://google.com", // TODO: metti la tua thank-you page GHL
      webhookUrl: "https://example.com/webhook-mollie", // opzionale
      metadata: {
        services: selectedServices,
        serviceNames,
        source: "GHL"
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

app.get("/", (req, res) => {
  res.send("Mollie-GHL backend è attivo 🚀");
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
