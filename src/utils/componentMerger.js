/**
 * Component Merger & Database Audit Algorithms
 * Programmatic deduplication, merge conflict resolution, and background AI database auditing.
 */

/**
 * Normalizes a part number by removing non-alphanumeric characters and converting to uppercase.
 */
export function normalizePartNumber(pn) {
  if (!pn) return '';
  return pn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Programmatic Merge Conflict Algorithm for components.
 * Merges two component definitions without wasting AI tokens.
 */
export function mergeComponentProfiles(compA, compB) {
  // Determine primary specs
  const merged = { ...compA };

  // 1. Value/Label: Keep the most descriptive/longer string
  if ((compB.value || '').length > (compA.value || '').length) {
    merged.value = compB.value;
  }
  if ((compB.label || '').length > (compA.label || '').length) {
    merged.label = compB.label;
  }

  // 2. Pins: Deduplicate and merge pins by name
  const pinMap = new Map();
  (compA.pins || []).forEach(p => pinMap.set(p.name, p));
  (compB.pins || []).forEach(p => {
    if (!pinMap.has(p.name)) {
      pinMap.set(p.name, p);
    } else {
      // If pin exists, merge properties (preferring coordinate points != 0)
      const existing = pinMap.get(p.name);
      pinMap.set(p.name, {
        ...existing,
        ...p,
        x: p.x || existing.x,
        y: p.y || existing.y
      });
    }
  });
  merged.pins = Array.from(pinMap.values());

  // 3. Price: Select the cheaper unit cost
  const parseCost = (costStr) => {
    if (!costStr) return Infinity;
    const num = parseFloat(costStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? Infinity : num;
  };
  const costA = parseCost(compA.cost);
  const costB = parseCost(compB.cost);
  if (costB < costA) {
    merged.cost = compB.cost;
  }

  // 4. Description: Keep the longer/more detailed description
  if ((compB.description || '').length > (compA.description || '').length) {
    merged.description = compB.description;
  }

  // 5. Stock: Combine stock quantities
  const parseStock = (stockStr) => {
    if (!stockStr) return 0;
    const num = parseInt(stockStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };
  const stockCount = parseStock(compA.stock) + parseStock(compB.stock);
  if (stockCount > 0) {
    merged.stock = `${stockCount.toLocaleString()} In Stock`;
  }

  // 6. Media assets: Keep valid images & datasheets
  merged.image = compA.image || compB.image || null;
  merged.datasheet = compA.datasheet || compB.datasheet || '';
  
  // Mark as merged
  merged.isMerged = true;
  return merged;
}

/**
 * Deduplicates a list of components programmatically using the merge conflict algorithm.
 */
export function deduplicateComponents(components) {
  const groups = new Map();

  components.forEach(comp => {
    // Check if the component has a manufacturer part number
    const pn = comp.partNumber || comp.label || comp.id;
    const key = normalizePartNumber(pn);
    
    if (!groups.has(key)) {
      groups.set(key, comp);
    } else {
      const existing = groups.get(key);
      const merged = mergeComponentProfiles(existing, comp);
      groups.set(key, merged);
    }
  });

  return Array.from(groups.values());
}

/**
 * Periodic / On-demand AI Auditor.
 * Audits the deduplicated database to verify pin labels, fix package standard names
 * (e.g. SOT-23 vs SOT23), and normalize values using the Direct Gemini Free Tier (no-token-waste).
 */
export async function auditDatabaseWithAI(components, geminiKey) {
  if (!geminiKey) {
    throw new Error("Gemini fallback key is required to run the free database audit.");
  }

  // Programmatically deduplicate first to shrink payload (conserving context size)
  const dedupedList = deduplicateComponents(components);

  const prompt = `You are a database normalization engine. Normalize this electronic component list.
Correct standard package descriptions (e.g., SOT23 to SOT-23, 0805SMD to 0805 SMD).
Audit component pins and ensure standard electrical designations (e.g., GND, VCC, IO).
Return the updated list as a valid JSON array matching the inputs. Do not wrap in markdown tags.

Input Components:
${JSON.stringify(dedupedList, null, 2)}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini Audit API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) throw new Error("Empty audit response.");

    let cleanJson = textOut.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("AI Database Audit failed, falling back to programmatic deduplication list:", e);
    return dedupedList;
  }
}
