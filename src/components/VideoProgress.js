// components/VideoProgress.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const VideoProgress = ({ city, onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    const checkProgress = async () => {
        try {
            const response = await fetch('/api/script-progress');
            const data = await response.json();

            console.log('Progress data:', data); // Для отладки

            setProgress(data.progress || 0);
            setCurrentStep(data.currentStep || '');
            setIsRunning(data.isRunning || false);

            // Если скрипт завершился и прогресс 100%
            if (!data.isRunning && data.progress === 100) {
                toast.success('Видео успешно обновлено!');
                onComplete && onComplete();
            }
            // Если скрипт не запущен и прогресс 0 (ошибка или отмена)
            else if (!data.isRunning && data.progress === 0) {
                onComplete && onComplete();
            }
        } catch (error) {
            console.error('Error checking progress:', error);
        }
    };

    useEffect(() => {
        // Запускаем polling сразу при монтировании
        const interval = setInterval(checkProgress, 1000);
        // Fallback: автоматическое скрытие через 5 минут
        const timeout = setTimeout(() => {
            console.warn('Progress timeout - forcing completion');
            onComplete && onComplete();
        }, 300000); // 5 минут


        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [onComplete]);

    // Скрываем компонент если не запущено и прогресс 0
    if (!isRunning && progress === 0) {
        return null;
    }

    return (
        <div className="progress-container" style={{
            padding: '20px',
            margin: '20px 0',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
        }}>
            <h4>Обновление видео для {city}</h4>

            <div className="progress-bar" style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden',
                margin: '10px 0'
            }}>
                <div
                    className="progress-fill"
                    style={{
                        width: `${progress}%`,
                        height: '100%',
                        backgroundColor: progress === 100 ? '#4CAF50' : '#2196F3',
                        transition: 'width 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                >
                    {progress}%
                </div>
            </div>

            <div className="current-step" style={{
                fontSize: '14px',
                color: '#666',
                textAlign: 'center',
                marginTop: '10px'
            }}>
                {currentStep}
            </div>

            {progress === 100 && (
                <div style={{
                    textAlign: 'center',
                    marginTop: '10px',
                    color: '#4CAF50',
                    fontWeight: 'bold'
                }}>
                    ✓ Завершено
                </div>
            )}
        </div>
    );
};

export default VideoProgress;