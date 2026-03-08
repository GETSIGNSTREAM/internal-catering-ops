"use client";

import { useState, useEffect } from "react";

export interface DriverLocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recordedAt: string | null;
}

interface UseDriverLocationOptions {
  /** For customer tracking page — location comes from tracking data */
  trackingLocation?: DriverLocationData | null;
  /** For admin page — poll driver location API by driver ID */
  driverId?: string | null;
  /** For driver page — use own browser GPS position */
  ownLocation?: { lat: number; lng: number } | null;
  /** Polling interval in ms (default 10000) */
  pollInterval?: number;
  /** Whether polling is enabled */
  enabled?: boolean;
}

/**
 * Custom hook for driver GPS location that supports 3 contexts:
 * 1. Customer tracking page — receives location from parent tracking data
 * 2. Admin order detail — polls GET /api/driver/location?driverId=X
 * 3. Driver page — uses own browser geolocation position
 */
export function useDriverLocation(options: UseDriverLocationOptions): DriverLocationData | null {
  const {
    trackingLocation,
    driverId,
    ownLocation,
    pollInterval = 10000,
    enabled = true,
  } = options;

  const [location, setLocation] = useState<DriverLocationData | null>(null);

  // Case 1: Customer page — location from tracking data prop
  useEffect(() => {
    if (trackingLocation) {
      setLocation(trackingLocation);
    }
  }, [trackingLocation]);

  // Case 2: Admin page — poll /api/driver/location?driverId=X
  useEffect(() => {
    if (!driverId || !enabled) return;

    let mounted = true;

    const fetchLocation = async () => {
      try {
        const res = await fetch(`/api/driver/location?driverId=${driverId}`);
        if (res.ok && mounted) {
          const data = await res.json();
          setLocation(data);
        }
      } catch {
        // Silently fail — will retry on next interval
      }
    };

    fetchLocation();
    const interval = setInterval(fetchLocation, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [driverId, pollInterval, enabled]);

  // Case 3: Driver page — use own browser GPS
  useEffect(() => {
    if (ownLocation) {
      setLocation({
        latitude: ownLocation.lat,
        longitude: ownLocation.lng,
        heading: null,
        speed: null,
        recordedAt: new Date().toISOString(),
      });
    }
  }, [ownLocation?.lat, ownLocation?.lng]);

  return location;
}
