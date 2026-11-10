# 🌱 FieldShift — AI-Powered Climate-Smart Agriculture

**Turning NASA Earth Observation Data into Smarter Farming Decisions.**

FieldShift is an AI-powered agricultural intelligence platform designed to help farmers make informed crop rotation decisions using NASA Earth observation data, soil intelligence, crop characteristics, climate analysis, and farmer priorities.

The platform helps farmers compare crop rotation strategies, identify environmental risks, explore climate scenarios, and develop more sustainable and climate-resilient farming plans.

Built for the **NASA International Space Apps Challenge 2026**.

---

## 🚀 The Problem

Climate change creates significant challenges for modern agriculture:

- Unpredictable rainfall and changing precipitation patterns.
- Increasing temperatures and drought risks.
- Soil moisture variability.
- Crop vulnerability to environmental stress.
- Soil degradation caused by unsuitable crop rotations.
- Limited access to data-driven agricultural planning tools.

Farmers need more than historical weather information. They need actionable insights that help them understand how environmental conditions can influence future crop rotation decisions.

## 💡 Our Solution

FieldShift combines NASA Earth observation datasets with agricultural intelligence to help farmers explore and compare crop rotation strategies.

The platform considers:

- NASA environmental observations.
- Local soil characteristics.
- Crop growing requirements.
- Historical crop rotation information.
- Farmer-specific priorities.
- Climate risks and hypothetical scenarios.

Instead of simply presenting environmental data, FieldShift transforms it into understandable agricultural insights and decision-support recommendations.

---

## ✨ Key Features

### 1. Farm Intelligence Dashboard
- Manage multiple farm profiles.
- View farm size and geographical information.
- Store soil characteristics.
- Select individual farms for analysis.

### 2. Farmer Priorities
Allow farmers to define their agricultural objectives, including:

- Supplemental income.
- Soil health improvement.
- Water conservation.
- Climate resilience.
- Risk reduction.
- Sustainable farming.

Recommendations consider these priorities when evaluating crop rotation strategies.

### 3. Crop Database
Maintain agricultural information about different crops:

- Growing seasons.
- Temperature requirements.
- Water requirements.
- Nutrient requirements.
- Nitrogen contribution.
- Root characteristics.
- Soil suitability.
- Pest and disease susceptibility.

### 4. Intelligent Crop Rotation Engine

The core decision-support component of FieldShift.

It evaluates multiple crop rotation strategies, including the existing rotation and alternative approaches.

It helps users:

- Compare different crop sequences.
- Evaluate crop suitability.
- Understand soil health implications.
- Analyze water and climate requirements.
- Identify potential agricultural risks.
- Understand the benefits and trade-offs of each strategy.

### 5. NASA Earth Observation Integration

FieldShift incorporates NASA Earth observation datasets to support environmental analysis.

| NASA Dataset | Agricultural Application |
|---|---|
| NASA POWER | Temperature, solar radiation, and meteorological indicators |
| NASA GPM | Precipitation and rainfall analysis |
| NASA SMAP | Surface soil moisture observations |
| NASA MODIS | Vegetation and land-surface monitoring |
| Landsat | Land-cover and vegetation observations |

These datasets help provide environmental context for agricultural decision-making.

**Important:** Satellite-derived observations are not equivalent to direct field measurements. Their spatial resolution, observation depth, availability, and uncertainty must be considered when interpreting results.

### 6. Historical Climate & Moisture Timeline
- Analyze historical rainfall patterns.
- Compare precipitation against baselines.
- Explore cumulative seasonal precipitation.
- Examine environmental trends.
- Identify periods that may require additional agricultural attention.

### 7. Bare-Field Detection
Analyze satellite-derived vegetation information to identify potentially exposed or low-vegetation periods.

This can help farmers explore:

- Bare-soil exposure.
- Potential erosion risks.
- Cover crop opportunities.
- Seasonal field conditions.

### 8. Pest & Disease Cycle Analysis
Evaluate crop rotation history and crop-host relationships to identify potential pest and disease pressure.

### 9. Soil Intelligence
Explore agricultural soil characteristics, including:

- Soil texture.
- Soil moisture.
- Organic matter.
- Nutrient availability.
- Soil pH.
- Drainage.
- Erosion susceptibility.

### 10. Field Risk Matrix
Organize environmental and agricultural risks into an understandable assessment.

Potential risk categories include:

- Drought.
- Excess rainfall.
- Heat stress.
- Soil erosion.
- Water availability.
- Pest and disease pressure.

### 11. What-If Climate Scenarios
Explore hypothetical environmental conditions and understand how they may influence crop rotation decisions.

Examples:

- What if rainfall decreases?
- What if temperatures increase?
- What if drought conditions become more frequent?
- What if a different crop is introduced into the rotation?

### 12. Interactive Farm Map
Visualize farm locations and relevant agricultural information through an interactive geographical interface.

### 13. Gemini AI Agricultural Advisor
FieldShift integrates Google's Gemini AI to help users understand agricultural analysis.

The AI Advisor can help:

- Explain crop rotation recommendations.
- Summarize environmental observations.
- Describe potential agricultural risks.
- Interpret scenario results.
- Explain complex agricultural information in simple language.

AI-generated explanations are intended to support decision-making, not replace professional agricultural advice.

---

## 🛰️ NASA Technologies & Data

FieldShift uses NASA Earth observation capabilities to connect environmental information with agricultural decision-making.

Our intended data workflow:

```text
NASA Earth Observation Data
          |
          v
Environmental Data Processing
          |
          v
Farm & Soil Information
          |
          v
Crop Characteristics
          |
          v
Farmer Priorities
          |
          v
Crop Rotation Engine
          |
          v
Climate Scenarios & Risk Analysis
          |
          v
Agricultural Recommendations
          |
          v
Gemini AI Explanation
```

Data availability, processing methods, baseline definitions, and uncertainty should be documented for each dataset.

---

## 🏗️ Platform Modules

| Module | Purpose |
|---|---|
| Overview | Agricultural intelligence dashboard |
| Farm Properties | Farm profile management |
| Farmer Priorities | Farmer objective configuration |
| Crop Database | Crop characteristics and requirements |
| Crop Rotation Engine | Rotation strategy evaluation |
| What-If Scenarios | Hypothetical climate analysis |
| NASA Data Roadmap | Earth observation data integration |
| Interactive Farm Map | Geographic visualization |
| Bare-Field Detector | Vegetation and bare-field analysis |
| Pest & Disease Cycles | Crop-host relationship analysis |
| Soil Intelligence | Soil condition assessment |
| Field Risk Matrix | Agricultural risk evaluation |
| Climate Timeline | Historical environmental trends |
| AI Advisor | Gemini-powered agricultural explanations |
| Compliance Reports | Agricultural analysis documentation |

---

## 🛠️ Technology Stack

FieldShift is built using modern web technologies and AI-powered services.

| Technology | Purpose |
|---|---|
| React / Next.js | Frontend application, depending on project configuration |
| JavaScript / TypeScript | Application development |
| Tailwind CSS | User interface styling |
| Three.js | Interactive 3D visualizations, where used |
| NASA POWER | Meteorological and environmental data |
| NASA GPM | Precipitation observations |
| NASA SMAP | Soil moisture observations |
| NASA MODIS / Landsat | Satellite-based land and vegetation observations |
| Google Gemini AI | AI-powered agricultural explanations |
| Vercel | Deployment, if configured |

See the actual project configuration and environment documentation for the confirmed dependencies and services.

---

## ⚙️ Getting Started

### Prerequisites

Install the following:

- Node.js (LTS recommended).
- npm.
- Git.
- Required API credentials for enabled integrations.

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd FieldShift
```

### 2. Install Dependencies

```bash
npm install
```

If the repository contains separate frontend and backend applications, install dependencies in their respective directories.

### 3. Configure Environment Variables

Create the required `.env` files using the supplied examples.

```bash
cp .env.example .env
```

For separate frontend and backend applications, configure each application's environment independently.

Check `ENVIRONMENT_VARIABLES.md` for the complete variable list and configuration instructions, if included in the repository.

Never commit actual API keys, passwords, or secrets.

### 4. Run the Development Server

Use the scripts defined in your project's `package.json`.

For example:

```bash
npm run dev
```

If the backend runs independently, start it using its own development script.

### 5. Build for Production

```bash
npm run build
```

Follow the deployment instructions for the actual frontend and backend architecture.

---

## 🔐 Security & Reliability

FieldShift is designed with attention to:

- Secure authentication.
- Server-side API key management.
- Environment-based configuration.
- Input validation.
- Error handling.
- AI service timeout handling.
- Graceful fallback behavior.
- Protection of private farm information.

When an external AI service is unavailable, any fallback analysis should be clearly identified rather than presented as a successful Gemini response.

---

## 🌍 Expected Impact

FieldShift aims to help farmers:

- Make more informed crop rotation decisions.
- Understand environmental conditions affecting agriculture.
- Explore climate-resilient agricultural strategies.
- Reduce avoidable agricultural risks.
- Improve soil management practices.
- Understand the relationship between climate observations and crop suitability.

Our goal is to make complex Earth observation information more accessible and useful for agricultural decision-making.

---

## 🔮 Future Improvements

- More detailed field-level satellite analysis.
- Expanded crop and regional soil databases.
- Improved crop yield and economic estimation.
- More robust historical climate comparisons.
- Enhanced drought and vegetation stress monitoring.
- Additional climate projection scenarios.
- Multilingual AI agricultural assistance.
- Integration with local agricultural and soil-testing services.
- Improved uncertainty quantification and recommendation explainability.

---

## 🏆 NASA Space Apps Challenge 2026

**Challenge:** Field Shift: Adapting Farms with NASA Data

**Project:** FieldShift

**Team:** HashLink

FieldShift demonstrates how NASA Earth observation data, agricultural intelligence, and AI can work together to support climate-smart farming decisions.

---

## 👥 Team HashLink

Developed by Team HashLink for the NASA International Space Apps Challenge 2026.

---

## 📄 License

Add your chosen open-source license here before distributing the project.

---

**FieldShift — Explore the data. Understand the risks. Grow smarter.**
