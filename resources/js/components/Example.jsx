import React, { useState } from 'react';

export default function Example() {
    const [count, setCount] = useState(0);

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>
                ¡Componente React Integrado Correctamente! 🚀
            </h2>
            <p style={{ marginBottom: '15px', color: '#555' }}>
                Este es un ejemplo de un componente de React funcionando dentro de tu aplicación Laravel con Vite.
            </p>
            <button
                onClick={() => setCount(count + 1)}
                style={{
                    backgroundColor: '#4F46E5',
                    color: '#FFF',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600'
                }}
            >
                Contador: {count}
            </button>
        </div>
    );
}
