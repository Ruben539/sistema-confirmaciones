import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Navigation } from 'lucide-react';

export default function GoogleLocationPicker({ value, onChange, placeholder = "Buscar ciudad, calle, barrio o local..." }) {
    const searchInputRef = useRef(null);
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerInstanceRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadGoogleMapsScript = () => {
            if (window.google && window.google.maps) {
                setIsLoaded(true);
                return;
            }

            const existingScript = document.getElementById("google-maps-script");
            if (existingScript) {
                existingScript.addEventListener('load', () => setIsLoaded(true));
                return;
            }

            const script = document.createElement("script");
            script.id = "google-maps-script";
            script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDAijF__6i8u6ibMDZXfrALOw0NPqvgwDk&libraries=places";
            script.async = true;
            script.defer = true;
            script.onload = () => {
                setIsLoaded(true);
            };
            document.head.appendChild(script);
        };

        loadGoogleMapsScript();
    }, []);

    useEffect(() => {
        if (!isLoaded || !mapContainerRef.current) return;

        // Default position: Asunción, Paraguay (-25.2637, -57.5759)
        const defaultPos = { lat: -25.2637, lng: -57.5759 };

        if (!mapInstanceRef.current) {
            const map = new window.google.maps.Map(mapContainerRef.current, {
                center: defaultPos,
                zoom: 13,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                zoomControl: true,
                styles: [
                    {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "simplified" }]
                    }
                ]
            });
            mapInstanceRef.current = map;

            const marker = new window.google.maps.Marker({
                position: defaultPos,
                map: map,
                draggable: true,
                animation: window.google.maps.Animation.DROP,
            });
            markerInstanceRef.current = marker;

            // Geocode helper to get address from LatLng
            const geocoder = new window.google.maps.Geocoder();
            const updateAddressFromLatLng = (latLng) => {
                geocoder.geocode({ location: latLng }, (results, status) => {
                    if (status === "OK" && results && results[0]) {
                        const formattedAddress = results[0].formatted_address;
                        onChange(formattedAddress);
                    }
                });
            };

            // Map click listener
            map.addListener("click", (e) => {
                const clickedLatLng = e.latLng;
                marker.setPosition(clickedLatLng);
                updateAddressFromLatLng(clickedLatLng);
            });

            // Marker dragend listener
            marker.addListener("dragend", () => {
                const draggedLatLng = marker.getPosition();
                updateAddressFromLatLng(draggedLatLng);
            });

            // Autocomplete setup on search input
            if (searchInputRef.current) {
                const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
                    types: ['geocode', 'establishment'],
                });
                autocomplete.bindTo("bounds", map);

                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry || !place.geometry.location) {
                        return;
                    }

                    if (place.geometry.viewport) {
                        map.fitBounds(place.geometry.viewport);
                    } else {
                        map.setCenter(place.geometry.location);
                        map.setZoom(17);
                    }

                    marker.setPosition(place.geometry.location);
                    const selectedName = place.formatted_address || place.name || searchInputRef.current.value;
                    onChange(selectedName);
                });
            }
        }
    }, [isLoaded]);

    // Geocode existing text value if map is initialized and user hasn't interacted
    const handleManualTextChange = (e) => {
        const textVal = e.target.value;
        onChange(textVal);

        if (isLoaded && window.google && mapInstanceRef.current && markerInstanceRef.current && textVal.length > 3) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address: textVal }, (results, status) => {
                if (status === "OK" && results && results[0] && results[0].geometry) {
                    const loc = results[0].geometry.location;
                    mapInstanceRef.current.setCenter(loc);
                    markerInstanceRef.current.setPosition(loc);
                }
            });
        }
    };

    return (
        <div className="space-y-3">
            {/* Search Input Box */}
            <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Buscador de Lugares
                    </span>
                    <span className="text-[11px] text-zinc-400 font-normal">Búsqueda en vivo Google Maps</span>
                </label>
                <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={value || ''}
                        onChange={handleManualTextChange}
                        placeholder={placeholder}
                        className="w-full text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pl-9 pr-4 py-3 font-medium shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Interactive Map Container */}
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md">
                <div 
                    ref={mapContainerRef} 
                    className="w-full h-56 bg-zinc-100 dark:bg-zinc-800 transition-opacity duration-300"
                    style={{ minHeight: '220px' }}
                />
                {!isLoaded && (
                    <div className="absolute inset-0 bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            <Navigation className="w-4 h-4 animate-spin text-emerald-500" /> Cargando Google Maps...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
