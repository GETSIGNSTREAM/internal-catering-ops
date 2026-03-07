"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeAddress, type GeocodedLocation } from "@/lib/geocode";

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recordedAt: string | null;
}

interface LiveDriverMapProps {
  /** Current driver GPS position */
  driverLocation: DriverLocation | null;
  /** Delivery address string (will be geocoded for destination pin) */
  deliveryAddress?: string | null;
  /** CSS height value (default "200px") */
  height?: string;
  /** Whether to show the destination pin (default true) */
  showDestination?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable live driver map component using Mapbox GL JS.
 * Shows a driver marker (orange dot) and optional destination pin.
 * Updates smoothly as driver location changes.
 */
export default function LiveDriverMap({
  driverLocation,
  deliveryAddress,
  height = "200px",
  showDestination = true,
  className = "",
}: LiveDriverMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const [destination, setDestination] = useState<GeocodedLocation | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const initialFitDoneRef = useRef(false);

  // Inject Mapbox CSS
  useEffect(() => {
    if (document.getElementById("mapbox-gl-css")) return;
    const link = document.createElement("link");
    link.id = "mapbox-gl-css";
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
    document.head.appendChild(link);
  }, []);

  // Geocode delivery address
  useEffect(() => {
    if (!showDestination || !deliveryAddress) return;
    geocodeAddress(deliveryAddress).then((loc) => {
      if (loc) setDestination(loc);
    });
  }, [deliveryAddress, showDestination]);

  // Initialize map
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    // Determine initial center
    const center: [number, number] = driverLocation
      ? [driverLocation.longitude, driverLocation.latitude]
      : destination
      ? [destination.longitude, destination.latitude]
      : [-118.2437, 34.0522]; // Default: Los Angeles

    let map: any;

    import("mapbox-gl").then((mod) => {
      if (!mapContainerRef.current) return;

      // Handle both ESM default export and CommonJS patterns
      const mapboxgl = mod.default || mod;
      (mapboxgl as any).accessToken = token;

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center,
        zoom: 13,
        attributionControl: false,
      });

      // Compact attribution
      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.on("load", () => {
        mapRef.current = map;
        setMapLoaded(true);
      });
    });

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
        driverMarkerRef.current = null;
        destMarkerRef.current = null;
        setMapLoaded(false);
        initialFitDoneRef.current = false;
      }
    };
  }, []); // Initialize once

  // Update driver marker
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !driverLocation) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default || mod;
      const map = mapRef.current;
      if (!map) return;

      const lngLat: [number, number] = [driverLocation.longitude, driverLocation.latitude];

      if (driverMarkerRef.current) {
        // Smoothly update position
        driverMarkerRef.current.setLngLat(lngLat);

        // Update rotation for heading
        if (driverLocation.heading !== null) {
          const el = driverMarkerRef.current.getElement();
          el.style.transform = `rotate(${driverLocation.heading}deg)`;
        }
      } else {
        // Create driver marker — orange pulsing dot
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;inset:0;background:#f59e0b;border-radius:50%;opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;inset:4px;background:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(245,158,11,0.6);"></div>
          </div>
          <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
        `;
        el.style.width = "24px";
        el.style.height = "24px";

        if (driverLocation.heading !== null) {
          el.style.transform = `rotate(${driverLocation.heading}deg)`;
        }

        const marker = new (mapboxgl as any).Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(map);

        driverMarkerRef.current = marker;
      }

      // Only follow driver if destination is not visible or no initial fit done
      if (!initialFitDoneRef.current && destination) {
        // Fit to show both driver and destination
        const bounds = new (mapboxgl as any).LngLatBounds();
        bounds.extend(lngLat);
        bounds.extend([destination.longitude, destination.latitude]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
        initialFitDoneRef.current = true;
      } else if (!initialFitDoneRef.current) {
        map.easeTo({ center: lngLat, zoom: 14, duration: 500 });
        initialFitDoneRef.current = true;
      } else {
        // Smoothly pan to follow driver
        map.easeTo({ center: lngLat, duration: 1000 });
      }
    });
  }, [mapLoaded, driverLocation?.latitude, driverLocation?.longitude, driverLocation?.heading]);

  // Update destination marker
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !destination || !showDestination) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default || mod;
      const map = mapRef.current;
      if (!map) return;

      if (destMarkerRef.current) {
        destMarkerRef.current.setLngLat([destination.longitude, destination.latitude]);
      } else {
        // Create destination marker — red pin
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="width:20px;height:20px;background:#ef4444;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
            <div style="width:4px;height:4px;background:rgba(0,0,0,0.3);border-radius:50%;margin-top:2px;"></div>
          </div>
        `;
        el.style.width = "20px";
        el.style.height = "28px";

        const marker = new (mapboxgl as any).Marker({ element: el, anchor: "bottom" })
          .setLngLat([destination.longitude, destination.latitude])
          .addTo(map);

        destMarkerRef.current = marker;
      }

      // If we have both, fit bounds
      if (driverLocation && !initialFitDoneRef.current) {
        const bounds = new (mapboxgl as any).LngLatBounds();
        bounds.extend([driverLocation.longitude, driverLocation.latitude]);
        bounds.extend([destination.longitude, destination.latitude]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
        initialFitDoneRef.current = true;
      }
    });
  }, [mapLoaded, destination, showDestination]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return null; // Don't render if no token
  }

  return (
    <div
      ref={mapContainerRef}
      className={`w-full ${className}`}
      style={{ height }}
    />
  );
}
