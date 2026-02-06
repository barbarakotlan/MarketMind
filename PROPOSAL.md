# MarketMind
**Lead:** Barbara Kotlan

## Overall Vision

MarketMind is a project that explores how machine learning can be applied to financial markets by using historical stock data to forecast future price movements. The vision behind the project is twofold: to provide users with forecasts that are both accessible and interpretable, and to create a flexible platform for experimenting with different predictive models. For the team, MarketMind also functions as an educational environment, encouraging experimentation, critical thinking, and the development of practical data science skills.

Beyond simply applying existing models, the project seeks to build a foundation for designing custom forecasting algorithms that can improve over time. Future directions may include integrating additional types of data, such as sentiment from financial news or social media, exploring portfolio-level predictions across multiple assets, and improving the transparency of forecasts so that users can understand not only what the prediction is, but also why the model reached that conclusion.

Building on the strong foundation established last semester—which includes a fully functional Flask backend, React frontend, ensemble ML models (Random Forest, XGBoost, Linear Regression), paper trading, and multi-asset support—this semester focuses on refinement, scalability, and advanced features. The team will refactor the existing codebase for maintainability, enhance model accuracy through hyperparameter tuning and new algorithms, and improve the user experience with a more polished interface. Ultimately, MarketMind aims to evolve from a functional prototype into a robust, production-ready platform that balances practicality with continuous innovation.

## Goals

This semester builds upon the existing MarketMind platform with three primary objectives:

1. **Codebase Refinement** - Refactor the backend and frontend for better maintainability, code quality, and developer experience. This includes improving error handling, adding comprehensive tests, and establishing coding standards.

2. **ML Model Enhancement** - Improve prediction accuracy through hyperparameter optimization, explore additional algorithms (LSTM, Prophet, Transformer-based models), and implement better feature engineering based on technical indicators and sentiment analysis.

3. **User Experience Improvement** - Polish the React frontend with better visualizations, improved responsiveness, and new features that make the platform more intuitive and useful for end users.

By the end of the semester, we aim to have a production-quality platform with measurably improved prediction accuracy, comprehensive documentation, and a codebase that future contributors can easily understand and extend.

## Team

- Barbara Kotlan (Lead)
- Tazeem Mahashin
- Kaden
- Elias

## Milestones

### Barbara (Lead)
**January:**
- Review current codebase state and identify refactoring priorities
- Create semester roadmap with specific deliverables and deadlines
- Set up project management (issues, milestones) in GitHub

**February:**
- Coordinate cross-functional work between ML and frontend teams
- Research and evaluate new data sources for model improvement
- Oversee code review process and documentation standards

**March:**
- Guide integration of new ML models with existing backend
- Ensure testing coverage meets project standards
- Plan and execute mid-semester demo

**April:**
- Final integration testing and bug fixes
- Prepare comprehensive documentation for future contributors
- Lead final presentation and demo preparation

---

### Tazeem (Full-Stack / Architecture)
**January:**
- Audit existing codebase for technical debt and improvement areas
- Set up CI/CD pipeline for automated testing and deployment
- Document current architecture and propose improvements

**February:**
- Refactor backend API for better structure and error handling
- Implement comprehensive logging and monitoring
- Add integration tests for critical endpoints
- Support ML model integration work as needed

**March:**
- Optimize database queries and API performance
- Implement caching strategies for frequently accessed data
- Help integrate new ML models into the prediction pipeline
- Support frontend improvements as needed

**April:**
- Performance testing and optimization
- Security audit and hardening
- Final documentation and deployment preparation
- Support team members with any blockers

---

### Kaden (Machine Learning)
**January:**
- Evaluate current model performance (MAE, RMSE, directional accuracy)
- Research advanced time-series models (LSTM, Prophet, Transformers)
- Set up ML experimentation framework with proper versioning

**February:**
- Implement hyperparameter tuning for existing ensemble models
- Develop and test LSTM-based prediction model
- Create evaluation pipeline for comparing model performance

**March:**
- Integrate sentiment analysis features into prediction models
- Implement feature importance analysis and model explainability
- A/B test new models against baseline ensemble

**April:**
- Finalize best-performing model configuration
- Document model architecture, training process, and results
- Prepare ML-focused sections of final presentation

---

### Elias (Frontend / React)
**January:**
- Audit current React components for code quality and patterns
- Create UI/UX improvement plan based on user feedback
- Set up frontend testing framework (Jest, React Testing Library)

**February:**
- Refactor components for better reusability and state management
- Improve chart visualizations with better interactivity
- Implement responsive design improvements for mobile

**March:**
- Add new visualization features (technical indicators, comparison charts)
- Improve loading states, error handling, and user feedback
- Implement any Node.js backend-for-frontend needs

**April:**
- Polish UI/UX based on testing feedback
- Performance optimization (code splitting, lazy loading)
- Final UI testing and bug fixes
- Prepare frontend demo materials

## Technical Stack

### Backend
- **Flask** - REST API framework
- **SQLAlchemy** - Database ORM (SQLite)
- **scikit-learn, XGBoost** - Machine learning models
- **yfinance, Alpha Vantage** - Financial data APIs
- **pandas, NumPy** - Data processing

### Frontend
- **React 19** - UI framework
- **Chart.js** - Data visualization
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

### Infrastructure
- **GitHub** - Version control and project management
- **Python venv** - Dependency management
- **npm** - Frontend package management

## Quick Start

```bash
# Backend Setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python migrate.py init
python migrate.py seed
python api.py  # Runs on http://localhost:5001

# Frontend Setup
cd frontend
npm install
npm start  # Runs on http://localhost:3000
```

## Success Metrics

- **Model Accuracy**: Improve MAPE by 10-15% over baseline
- **Code Quality**: 80%+ test coverage on critical paths
- **Performance**: API response times under 500ms for all endpoints
- **Documentation**: Complete API docs and contributor guide
