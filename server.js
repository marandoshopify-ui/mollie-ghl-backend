const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// ⬇️ METTI QUI LA TUA MOLLIE API KEY DI TEST (poi live_)
const MOLLIE_API_KEY = "test_mAp53HbnD6hcPuze3bNtu7qBNjSHst";

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/create-payment", async (req, res) => {
  try {
    const plan = req.body.plan || "TEST";
    const amount = req.body.amount || "10.00";

    const payload = {
      amount: {
        currency: "EUR",
        value: amount
      },
      description: `Pagamento piano ${plan} da GHL`,
      redirectUrl: "https://google.com",
      webhookUrl: "https://example.com/webhook-mollie",
      metadata: {
        plan,
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
