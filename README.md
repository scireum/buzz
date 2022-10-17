# scireum BUZZ

Die BUZZ Schnittstelle ist eine Nachrichten-orientierte API zum Verbinden von unterschiedlichen Webseiten sowie nativen
Anwendungen wie beispielsweise Apps in Electron, Android oder iOS. Über die Schnittstelle können beispielsweise 
Konfiguratoren oder Produkt-Auswahlhilfen (z.B. OXOMI) in Webshops integriert werden. Weiterhin kann ein Shop direkt
mit einem Handwerker-ERP Daten austauschen.

Die Nachrichten-orientierte Ansatz gewährt eine konsistente und sichere API zwischen allen Plattformen. Über die
BUZZ Bibliothek können mehrere "Links", also Punkt-zu-Punkt Verbindungen definiert werden. Dies ist vor allem dann
sinnvoll, wenn ein Shop-System, sowohl mit einem Handwerker-ERP kommunizieren möchte, als auch selbst Konfiguratoren
oder andere Auswahl-Hilfen einbinden möchte.

## Verwendung

Nach dem Einbinden der BUZZ Bibliothek, kann ein "Connector" zu dem Haupt-Link "nach Außen" aufgebaut werden. Dieser
wird verwendet, wenn die Webseite z.B. in einem iFrame geladen wird:

```javascript
const catalog = new buzz.Connector({
    name: 'catalog'
});
```

Anschließend kann geprüft werden, ob die Gegenstelle vorhanden ist und bestimmte Funktionen unterstützt:

```javascript
catalog.queryCapability('item', function() {
    // Die Gegenstelle kann Informationen zur Artikeln bieten -> anfragen und anzeigen...
    document.querySelectorAll('.item').forEach(function(node) {
        catalog.call('item', {}, {item: node.dataset['item']}, function(response) {
            node.querySelector('.price').textContent = response.payload().price;
            node.querySelector('.availability').textContent = response.payload().availability;
        });
    });
});
```

Wird aktiv selbst eine fremde Komponente eingebunden, so kann ein eigener Link eingerichtet werden:
```javascript
const client = new buzz.Connector({
    name: 'shop',
    link: 'inner'
});
```

Dieser kann dann der Komponente mitgeteilt werden, oder an einen iFrame angedockt werden:
```javascript
 new buzz.installDownlink(window.catalogFrame, {link: 'inner'});
```

Alternativ kann ein iFrame auch direkt an den "Haupt-link" konfiguriert werden, wenn keine Schnittstelle "nach außen"
benötigt wird:
```javascript
 new buzz.installDownlink(window.catalogFrame, {});
```

Beispiele finden sich in [shop.html](shop.html) sowie [catalog.html](catalog.html).

## Standard-Nachrichten

Um einen sinnvollen Austausch unterschiedlicher Systeme zu ermöglichen, werden im folgenden Nachrichten für gängige
Geschäftsprozesse spezifiziert. Hierbei wird immer der Mindestumfang von Nachrichten angegeben, weitere Felder können
nach Bedarf mi-übermittelt werden.

### Preis und Verfügbarkeit

Elemente wie Konfiguratoren oder erweiterte Artikeldatenbanken benötigen Informationen bezüglich Preis und Verfügbarkeit
eines Artikels. Hierfür wird die "capability" bzw. der Nachrichten-Type **priceAvailability** verwendet. Um die
Anzeige weiter anzupassen, können Artikelnummer, Type und Kurztext überschrieben werden (um so z.B. eine Herstellernummer
durch eine eigene Artikelnummer zu ersetzen).

**Request**
* version: Versionsnummer der Nachricht. Derzeit immer "1".
* supplierNumber: Gibt die Herstellernummer/Lieferantennummer an, falls bekannt. Falls ein eigener Artikel angefragt wird, kann hier "-" verwendet werden. Falls die Herstellernummer unbekannt ist, kann der Parameter weggelassen werden.
* itemNumber: Gibt die Artikelnummer an, für die Informationen geliefert werden.

**Response**
* itemNumber: Die effektive Artikelnummer die angezeigt werden soll (optional)
* model: Die effektive Type die angezeigt werden soll (optional)
* shortText: Der effektive Kurztext der angezeigt werden soll (optional)
* availability
* availabilityMessage
* primaryPrice
* secondaryPrice

### Auskunft zu Artikeldaten bereitstellen

Neben der reinen Anzeige von Preis- und Verfügbarkeit, können mit **itemData** noch weitere Informationen abgefragt
werden. Die Anfrage ist hierbei gleich wie bei **priceAvailability**.

**Response**
* *Felder aus **priceAvailability** Antwort*
* previewImageUrl: Url zu einem Vorschaubild (optional)
* datasheetUrl: Url zu einem Datenblatt / Produkt-Detailseite (optional)

### Artikel in Warenkorb übernehmen

Um Artikel in den Warenkorb zu legen, werden unterschiedliche Capabilities / Nachrichten verwendet:

* **addItemToBasket**
  * supplierNumber: Lieferantennummer
  * itemNumber: Artikelnummer
  * quantity: Menge
  * unit: Mengeneinheit (optional)
  * shortText: Kurzbeschreibung der Position
  * supplierName: Name des Herstellers / der Marke
  * previewImageUrl: Vorschaubild für den Artikel


## Lizenz
```
MIT License

Copyright (c) 2022 scireum GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
