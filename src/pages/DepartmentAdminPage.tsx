import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { MyGroup, useMyScopedAdminGroups } from '@/hooks/useGroups';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DepartmentSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  memberCount: number;
};

const DepartmentAdminPage: React.FC = () => {
  const location = useLocation();
  const navigationGroups = (location.state as { adminGroups?: Omit<MyGroup, 'is_faculty'>[] } | null)?.adminGroups || [];
  const { data: queriedAdminGroups, isLoading: groupsLoading } = useMyScopedAdminGroups();
  const adminGroups = queriedAdminGroups?.length ? queriedAdminGroups : navigationGroups;
  const groupIds = adminGroups.map((group) => group.id);

  const { data: departments = [], isLoading: detailsLoading } = useQuery<DepartmentSummary[]>({
    queryKey: ['department-admin-summaries', groupIds],
    enabled: groupIds.length > 1,
    queryFn: async () => {
      const [{ data: groups, error: groupsError }, { data: members, error: membersError }] = await Promise.all([
        supabase.from('groups').select('id, slug, name, description').in('id', groupIds).order('name'),
        supabase.from('group_members').select('group_id').in('group_id', groupIds).eq('status', 'active'),
      ]);
      if (groupsError) throw groupsError;
      if (membersError) throw membersError;

      const memberCounts = new Map<string, number>();
      (members || []).forEach((member) => {
        memberCounts.set(member.group_id, (memberCounts.get(member.group_id) || 0) + 1);
      });

      return (groups || []).map((group) => ({
        ...group,
        memberCount: memberCounts.get(group.id) || 0,
      }));
    },
  });

  if (groupsLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-9 w-52" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-md" />)}
        </div>
      </div>
    );
  }

  if (adminGroups.length === 0) {
    return <Navigate to="/feed" replace />;
  }

  if (adminGroups.length === 1) {
    return <Navigate to={`/groups/${adminGroups[0].slug}/dashboard`} replace />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-display font-bold">Department Admin</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Choose a department to manage.</p>
      </header>

      {detailsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-md" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <Link
              key={department.id}
              to={`/groups/${department.slug}/dashboard`}
              state={{ returnTo: '/groups/admin', adminGroups }}
            >
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h2 className="font-semibold">{department.name}</h2>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                        {department.description || 'Private department portal'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {department.memberCount} {department.memberCount === 1 ? 'member' : 'members'}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DepartmentAdminPage;
