'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the builder page with the project ID
    router.replace(`/dashboard/builder?projectId=${params.id}`);
  }, [params.id]);

  return null; // No need to render anything as we're redirecting
} 