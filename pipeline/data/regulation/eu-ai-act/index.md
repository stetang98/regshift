---
title: EU AI Act Source Corpus Index
regulation: "Regulation (EU) 2024/1689"
url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689"
generated: "2026-07-02"
---

# EU AI Act Source Corpus

Complete collection of core compliance articles from **Regulation (EU) 2024/1689** (EU AI Act) in verbatim markdown format, suitable for regulatory analysis and compliance pipelines.

## Key Applicability Dates

- **2 August 2026**: Obligations for high-risk AI systems under Annex III enter into force (transition period for existing systems)
- **1 February 2025**: Most rules on general-purpose AI models already apply
- **12 months from publication**: Transparency obligations for certain AI systems apply

## Articles in Corpus

### Provider-Focused Requirements (Development & Design)

| Article | Title | Paragraphs | Focus |
|---------|-------|-----------|-------|
| [Art. 9](art-09.md) | Risk Management System | 10 | Continuous lifecycle risk identification, analysis, and mitigation framework |
| [Art. 10](art-10.md) | Data and Data Governance | 6 | Training/validation data quality, bias detection, special category data handling |
| [Art. 12](art-12.md) | Record-Keeping | 3 | Automatic logging of system events for traceability and post-market monitoring |
| [Art. 13](art-13.md) | Transparency and Information to Deployers | 3 | Instructions for use, system capabilities, performance metrics, human oversight measures |
| [Art. 14](art-14.md) | Human Oversight | 5 | Human-in-the-loop controls, automation bias mitigation, dual-verification for biometric systems |
| [Art. 15](art-15.md) | Accuracy, Robustness and Cybersecurity | 5 | Performance consistency, adversarial resilience, feedback loop handling, data poisoning defense |

### Deployer-Focused Requirements (Deployment & Operation)

| Article | Title | Paragraphs | Focus |
|---------|-------|-----------|-------|
| [Art. 26](art-26.md) | Obligations of Deployers of High-Risk AI Systems | 12 | Compliance with instructions, human oversight assignment, monitoring, incident reporting, log retention (6+ months) |
| [Art. 50](art-50.md) | Transparency for Specific AI Categories | 7 | Disclosure of AI interaction, synthetic content marking, emotion recognition/biometric categorization transparency, deep fake disclosure |

## System Coverage

These articles apply to **high-risk AI systems** as defined in Annex III of the regulation, including:
- Biometric identification systems (Art. 1(a) Annex III)
- Critical infrastructure systems
- Education and training systems
- Employment and worker management systems
- Judicial proceedings and essential services systems
- Law enforcement systems

## Corpus Characteristics

- **Source**: https://artificialintelligenceact.eu/
- **Fetch Method**: WebFetch from official sources (2026-07-02)
- **Verbatim Fidelity**: 100% — paragraph numbering and text preserved exactly as published
- **Format**: Markdown with YAML frontmatter per article
- **File Structure**: `art-<NN>.md` with consistent metadata envelope

## Usage Notes for Compliance Pipelines

1. **Risk Management Pipeline** (Art. 9, 10): Use to validate provider risk assessment documentation and data governance processes
2. **Operational Monitoring** (Art. 12, 26): Extract logging and retention requirements for audit systems
3. **Transparency Validation** (Art. 13, 14, 50): Cross-check deployment documentation against disclosure requirements
4. **Deployer Compliance** (Art. 26): Validate end-user deployment practices, oversight assignment, incident procedures

## References

- Full Regulation: [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689)
- Official Portal: [ArtificialIntelligenceAct.eu](https://artificialintelligenceact.eu/)
- Annex III (High-Risk AI Systems): Defines scope of above articles
- Article 49 (EU Database Registration): References deployer registration requirements
- Article 72 (Post-Market Monitoring): Linked to Art. 12 logging requirements
- Article 79 (Risk Definition): Referenced by Art. 9, 12, 26
