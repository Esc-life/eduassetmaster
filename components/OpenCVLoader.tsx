'use client';

import Script from 'next/script';

export function OpenCVLoader() {
    return (
        <Script
            src="https://docs.opencv.org/4.8.0/opencv.js"
            strategy="beforeInteractive"
            onLoad={() => console.log('OpenCV Loaded')}
        />
    );
}
