import { ConditionRecommendation, FarmerContextInput } from '../data/cropsKnowledgeBase';

export type NetworkTransport = 'wifi' | 'telco' | 'none';
export type NetworkSimulationMode = 'auto' | 'wifi_priority' | 'telco_only' | 'offline';

export interface NetworkStatusReport {
  isConnected: boolean;
  activeTransport: NetworkTransport;
  wifiAvailable: boolean;
  telcoAvailable: boolean;
  priorityLabel: string;
}

export interface SavedFieldCase {
  id: string;
  createdAt: string;
  source: 'offline_engine' | 'gemini_cloud' | 'unresolved_saved';
  transportUsed?: NetworkTransport;
  cropCommonName: string;
  cropScientificName: string;
  diagnosisName: string;
  pathogenScientificName: string;
  category: string;
  probabilityPercent: number;
  summary: string;
  recommendations: ConditionRecommendation;
  roiImageDataUrl: string;
  context: FarmerContextInput;
  payloadKb?: number;
}

export interface GeminiCloudDiagnosisResponse {
  cropCommonName: string;
  cropScientificName: string;
  diagnosisName: string;
  pathogenScientificName: string;
  category: string;
  probabilityPercent: number;
  reasoning: string;
  recommendations: ConditionRecommendation;
}

const STORAGE_KEY = 'agroguard_field_cases_v1';

/**
 * Evaluates network transport using Wi-Fi Priority First, falling back to Telco/Cellular
 * only when Wi-Fi is unavailable. Supports real browser NetworkInformation + test override.
 */
export function resolveNetworkPriority(mode: NetworkSimulationMode): NetworkStatusReport {
  if (mode === 'wifi_priority') {
    return {
      isConnected: true,
      activeTransport: 'wifi',
      wifiAvailable: true,
      telcoAvailable: true,
      priorityLabel: 'Wi-Fi Connected (Priority 1 selected over Telco)',
    };
  }
  if (mode === 'telco_only') {
    return {
      isConnected: true,
      activeTransport: 'telco',
      wifiAvailable: false,
      telcoAvailable: true,
      priorityLabel: 'Telco Cellular Connected (Wi-Fi unavailable)',
    };
  }
  if (mode === 'offline') {
    return {
      isConnected: false,
      activeTransport: 'none',
      wifiAvailable: false,
      telcoAvailable: false,
      priorityLabel: 'No Wi-Fi or Telco Signal (Offline)',
    };
  }

  // Auto / Live browser signal detection
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!online) {
    return {
      isConnected: false,
      activeTransport: 'none',
      wifiAvailable: false,
      telcoAvailable: false,
      priorityLabel: 'No Wi-Fi or Telco Signal (Offline)',
    };
  }

  const navConn = (navigator as unknown as {
    connection?: { type?: string; effectiveType?: string };
  }).connection;

  const rawType = navConn?.type?.toLowerCase();
  if (rawType === 'cellular') {
    return {
      isConnected: true,
      activeTransport: 'telco',
      wifiAvailable: false,
      telcoAvailable: true,
      priorityLabel: 'Telco Cellular Connected (Wi-Fi unavailable)',
    };
  }

  // Default connected state prioritizes Wi-Fi / Ethernet over cellular
  return {
    isConnected: true,
    activeTransport: 'wifi',
    wifiAvailable: true,
    telcoAvailable: true,
    priorityLabel: 'Wi-Fi Signal Available (Priority 1)',
  };
}

export function loadSavedCases(): SavedFieldCase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFieldCase(entry: SavedFieldCase): SavedFieldCase[] {
  const existing = loadSavedCases().filter((c) => c.id !== entry.id);
  const updated = [entry, ...existing].slice(0, 40);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Handle storage quota gracefully by keeping recent 15 entries
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 15)));
  }
  return updated;
}

export function deleteFieldCaseFromMemory(caseId: string): SavedFieldCase[] {
  const updated = loadSavedCases().filter((c) => c.id !== caseId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function requestGeminiCloudDiagnosis(params: {
  roiImageDataUrl: string;
  transportUsed: NetworkTransport;
  context: FarmerContextInput;
}): Promise<GeminiCloudDiagnosisResponse> {
  const base64Data = params.roiImageDataUrl.includes(',')
    ? params.roiImageDataUrl.split(',')[1]
    : params.roiImageDataUrl;

  const response = await fetch('/api/cloud-diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64Data,
      mimeType: 'image/jpeg',
      transportUsed: params.transportUsed,
      context: params.context,
    }),
  });

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    throw new Error(errPayload.error || `Cloud diagnosis failed (HTTP ${response.status})`);
  }

  return response.json();
}
