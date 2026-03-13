'use client';

import { useState, useEffect, useRef } from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'sources' | 'usage'>('about');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-lg shadow-xl w-full sm:max-w-3xl max-h-[70vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center bg-white flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Over dit project</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
            aria-label="Sluiten"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-2 sm:px-6 overflow-x-auto scrollbar-hide bg-white flex-shrink-0">
          {(['about', 'sources', 'usage'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-3 sm:px-4 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {{ about: 'Over', sources: 'Bronnen', usage: 'Gebruik' }[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          {activeTab === 'about' && (
            <div className="space-y-4">
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Venstertijdenviewer</h3>
                <p className="text-gray-700 text-sm leading-relaxed mb-3">
                  Een interactieve kaartviewer voor verkeersborden met tijdvensters in Nederlandse gemeenten.
                  Deze tool visualiseert data van de <strong>NDW Verkeersborden API</strong> (&ldquo;George&rdquo;) en maakt het
                  eenvoudig om bezorgvensters, spitsafsluitingen en vrachtverboden met tijdvensters te vinden en te analyseren.
                </p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  De viewer richt zich op de G4 en G40 gemeenten en biedt ondersteuning aan gemeenten, vervoerders,
                  logistiek dienstverleners en beleidsmakers bij het in kaart brengen van tijdgebonden verkeersbeperkingen
                  voor stedelijke logistiek.
                </p>
              </section>

              <section>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Features</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>Interactieve kaart met alle verkeersborden met venstertijden</li>
                  <li>Filtering op categorie, gemeente en RVV-code</li>
                  <li>Vergelijking van NDW API V4 en V5 payloads per bord</li>
                  <li>PDOK adreszoeker met locatieweergave</li>
                  <li>PDOK gemeentegrenzen overlay (WMS)</li>
                  <li>Directe link naar NDW George per verkeersbord</li>
                  <li>Responsive design voor desktop en mobiel</li>
                </ul>
              </section>

              <section>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Categorisering</h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  Verkeersborden worden automatisch ingedeeld in categorie&euml;n op basis van hun RVV-code:
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#3b82f6' }} />
                    <strong>Bezorgvenster</strong> &mdash; G7 (voetgangerszone), C1 (gesloten in beide richtingen)
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#eab308' }} />
                    <strong>Spitsafsluiting</strong> &mdash; C6, C12 (gesloten voor motorvoertuigen)
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#f97316' }} />
                    <strong>Vrachtverbod</strong> &mdash; C7, C7a, C7b, C21 (gesloten voor vrachtverkeer)
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#6b7280' }} />
                    <strong>Overig</strong> &mdash; overige RVV-codes met tijdvensters
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-md font-semibold text-gray-900 mb-2">Open Source</h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  Dit project is open source. Broncode, issues en bijdragen:
                </p>
                <a
                  href="https://github.com/robbertj85/venstertijdenviewer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub Repository
                </a>
              </section>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-4">
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Bronnen</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Alle verkeersborddata wordt opgehaald via de openbare NDW Verkeersborden API, ook bekend als
                  &ldquo;George&rdquo;. Aanvullende geodata komt van PDOK.
                </p>
              </section>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition">
                  <div className="flex items-start">
                    <div className="w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 bg-blue-600" />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-sm text-gray-900">NDW Verkeersborden API (&ldquo;George&rdquo;)</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Type:</span> Public REST API (Open Data)
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        De primaire databron voor alle verkeersborden met venstertijden. Beschikbaar in twee versies:
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500 font-mono break-all">
                          <span className="font-medium text-gray-600">V4:</span> data.ndw.nu/api/rest/static-road-data/traffic-signs/v4/current-state
                        </p>
                        <p className="text-xs text-gray-500 font-mono break-all">
                          <span className="font-medium text-gray-600">V5:</span> data.ndw.nu/api/rest/static-road-data/traffic-signs/v5/current-state
                        </p>
                      </div>
                      <div className="flex gap-3 mt-2">
                        <a href="https://data.ndw.nu" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800">data.ndw.nu ↗</a>
                        <a href="https://wegkenmerken.ndw.nu" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800">George viewer ↗</a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition">
                  <div className="flex items-start">
                    <div className="w-4 h-4 rounded-full mt-0.5 mr-3 flex-shrink-0 bg-green-600" />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-sm text-gray-900">NWB Wegenbestand</h5>
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Type:</span> Referentiebestand
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        NDW koppelt bordlocaties aan het Nationaal Wegenbestand (NWB). De NWB-versie bepaalt de nauwkeurigheid
                        van de coördinaten en wegvak-informatie.
                      </p>
                      <a href="https://data.overheid.nl/dataset/nationaal-wegen-bestand-wegen-wgl-" target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block">data.overheid.nl ↗</a>
                    </div>
                  </div>
                </div>
              </div>

              <section className="border-t pt-4 mt-4">
                <h4 className="text-md font-semibold text-gray-900 mb-2">Aanvullende Bronnen</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>
                    <strong>Adreszoeken:</strong> PDOK Locatieserver
                    <span className="text-gray-500 ml-2">Publieke Dienstverlening Op de Kaart</span>
                  </li>
                  <li>
                    <strong>Reverse geocoding:</strong> PDOK Locatieserver (reverse endpoint)
                    <span className="text-gray-500 ml-2">Straatnamen bij coördinaten</span>
                  </li>
                  <li>
                    <strong>Gemeentegrenzen:</strong> PDOK Bestuurlijke Gebieden WMS
                    <span className="text-gray-500 ml-2">Kadaster</span>
                  </li>
                  <li>
                    <strong>Kaartachtergrond:</strong> CartoDB / OpenStreetMap
                    <span className="text-gray-500 ml-2">© OpenStreetMap contributors</span>
                  </li>
                  <li>
                    <strong>RVV bordafbeeldingen:</strong> Wikimedia Commons
                    <span className="text-gray-500 ml-2">Public domain SVG&apos;s</span>
                  </li>
                </ul>
              </section>

              <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">V4 vs V5 API</h4>
                <p className="text-sm text-blue-800 mb-2">
                  De NDW Verkeersborden API is beschikbaar in twee versies. V5 bevat extra gestructureerde velden
                  zoals <code className="text-xs bg-blue-100 px-1 rounded">conditions</code>, <code className="text-xs bg-blue-100 px-1 rounded">supplementarySigns</code> en <code className="text-xs bg-blue-100 px-1 rounded">openingHours</code> in
                  OSM-formaat. Via de detail-weergave van een bord kun je de twee versies direct vergelijken.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-4">
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Gebruiksvoorwaarden</h3>
                <p className="text-sm text-gray-700 mb-3">
                  Dit project is bedoeld voor onderzoek, beleidsvorming en niet-commercieel gebruik
                  in het kader van stedelijke logistiek en verkeersmanagement.
                </p>
              </section>

              <section>
                <h4 className="text-md font-semibold text-gray-900 mb-3">NDW Open Data</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    De verkeersborddata van NDW is beschikbaar als <strong>open data</strong> en valt
                    onder het <a href="https://data.ndw.nu/gebruiksvoorwaarden" target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800">NDW Open Data beleid</a>.
                  </p>
                  <p>
                    <strong>Bronvermelding:</strong> Bij gebruik van deze data dient NDW als bron vermeld te worden.
                  </p>
                  <p>
                    <strong>Actualiteit:</strong> NDW werkt de verkeersborddata regelmatig bij. De NWB-versie en
                    het ophaalmoment worden rechtsboven in de header weergegeven.
                  </p>
                </div>
              </section>

              <section className="border-t pt-4 mt-4">
                <h4 className="text-md font-semibold text-gray-900 mb-2">Vereiste Attributie</h4>
                <p className="text-sm text-gray-700 mb-3">
                  Bij gebruik of redistributie van data uit deze viewer:
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono">
                  <pre className="whitespace-pre-wrap text-gray-800">
{`Databron: NDW Verkeersborden API (George)
- V4: data.ndw.nu/api/rest/static-road-data/traffic-signs/v4
- V5: data.ndw.nu/api/rest/static-road-data/traffic-signs/v5
- Website: https://data.ndw.nu

Aanvullend:
- PDOK Locatieserver (geocoding)
- PDOK Bestuurlijke Gebieden (gemeentegrenzen)
- Kaartdata © OpenStreetMap contributors
- RVV bordafbeeldingen: Wikimedia Commons

Project: Venstertijdenviewer
Repository: github.com/robbertj85/venstertijdenviewer`}
                  </pre>
                </div>
              </section>

              <section className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Disclaimer</h4>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Dit project wordt geleverd &ldquo;as is&rdquo; zonder garantie. Data is afkomstig van de openbare
                  NDW Verkeersborden API en kan onnauwkeurigheden bevatten. De categorisering van borden
                  (bezorgvenster, spitsafsluiting, vrachtverbod) is een interpretatie op basis van RVV-codes
                  en onderbordteksten. Raadpleeg altijd de officiële NDW George viewer voor de meest actuele
                  en correcte informatie. Dit project is niet gelieerd aan NDW.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition font-medium text-base sm:text-sm"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
