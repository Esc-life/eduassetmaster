'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';

// --- Message Context ---
type MessageType = 'alert' | 'confirm' | 'error' | 'success';

interface MessageOptions {
    title?: string;
    message: string;
    type?: MessageType;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface MessageContextType {
    showAlert: (message: string, type?: MessageType) => void;
    showConfirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
    showAlertAsync: (message: string, type?: MessageType) => Promise<void>;
    showConfirmAsync: (message: string) => Promise<boolean>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<MessageOptions | null>(null);

    const showAlert = useCallback((message: string, type: MessageType = 'alert') => {
        setOptions({ message, type });
        setIsOpen(true);
    }, []);

    const showAlertAsync = useCallback((message: string, type: MessageType = 'alert') => {
        return new Promise<void>((resolve) => {
            setOptions({
                message,
                type,
                onConfirm: () => {
                    setIsOpen(false);
                    resolve();
                }
            });
            setIsOpen(true);
        });
    }, []);

    const showConfirm = useCallback((message: string, onConfirm: () => void, onCancel?: () => void) => {
        setOptions({
            message,
            type: 'confirm',
            onConfirm: () => {
                onConfirm();
                setIsOpen(false);
            },
            onCancel: () => {
                if (onCancel) onCancel();
                setIsOpen(false);
            }
        });
        setIsOpen(true);
    }, []);

    const showConfirmAsync = useCallback((message: string) => {
        return new Promise<boolean>((resolve) => {
            setOptions({
                message,
                type: 'confirm',
                onConfirm: () => {
                    setIsOpen(false);
                    resolve(true);
                },
                onCancel: () => {
                    setIsOpen(false);
                    resolve(false);
                }
            });
            setIsOpen(true);
        });
    }, []);

    const handleClose = () => {
        if (options?.onCancel) options.onCancel();
        setIsOpen(false);
    };

    const handleConfirm = () => {
        if (options?.onConfirm) {
            options.onConfirm();
        } else {
            setIsOpen(false);
        }
    };

    return (
        <MessageContext.Provider value={{ showAlert, showConfirm, showAlertAsync, showConfirmAsync }}>
            {children}
            <AnimatePresence>
                {isOpen && options && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`p-2 rounded-full ${options.type === 'error' ? 'bg-red-100 text-red-600' :
                                        options.type === 'success' ? 'bg-green-100 text-green-600' :
                                            options.type === 'confirm' ? 'bg-blue-100 text-blue-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {options.type === 'error' ? <AlertCircle className="w-6 h-6" /> :
                                            options.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> :
                                                options.type === 'confirm' ? <Info className="w-6 h-6" /> :
                                                    <Info className="w-6 h-6" />}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {options.type === 'error' ? '오류' :
                                            options.type === 'success' ? '성공' :
                                                options.type === 'confirm' ? '확인' : '알림'}
                                    </h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">
                                    {options.message}
                                </p>
                            </div>
                            <div className="flex border-t border-gray-100 dark:border-gray-800">
                                {options.type === 'confirm' && (
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 px-4 py-4 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-r border-gray-100 dark:border-gray-800"
                                    >
                                        취소
                                    </button>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 px-4 py-4 text-sm font-bold text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    확인
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </MessageContext.Provider>
    );
}

// --- Combined Providers ---
export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <MessageProvider>
                {children}
            </MessageProvider>
        </SessionProvider>
    );
}

export const useMessage = () => {
    const context = useContext(MessageContext);
    if (!context) throw new Error('useMessage must be used within a MessageProvider');
    return context;
};
