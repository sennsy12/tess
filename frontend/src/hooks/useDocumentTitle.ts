import { useEffect } from 'react';

const APP_NAME = 'TESS';
const DEFAULT_TITLE = `${APP_NAME} - Sales Order Management`;

export function useDocumentTitle(pageTitle?: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : DEFAULT_TITLE;
    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
}
