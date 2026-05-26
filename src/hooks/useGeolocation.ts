import { useEffect, useState } from 'react';

export interface GeolocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

const INITIAL: GeolocationState = {
  lat: null,
  lng: null,
  accuracy: null,
  error: null,
  loading: true,
};

export function useGeolocation(enabled = true): GeolocationState {
  const [state, setState] = useState<GeolocationState>(INITIAL);

  useEffect(() => {
    if (!enabled) {
      setState({ ...INITIAL, loading: false });
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState({
        ...INITIAL,
        loading: false,
        error: 'Geolocalização não suportada neste dispositivo.',
      });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState({
          lat: null,
          lng: null,
          accuracy: null,
          loading: false,
          error: err.message,
        });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
