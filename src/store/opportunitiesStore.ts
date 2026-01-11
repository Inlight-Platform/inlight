import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from './useStore';

export type OpportunityType = 'Gig' | 'Short Film' | 'Feature' | 'Touring' | 'Remote Session';
export type PaidStatus = 'Paid' | 'Unpaid';
export type UnionStatus = 'Union' | 'Non-Union' | 'Open';
export type CompensationPer = 'Day' | 'Week' | 'Flat';

export interface Opportunity {
  id: string;
  title: string;
  companyName: string;
  typeTag: OpportunityType;
  paidStatus: PaidStatus;
  unionStatus: UnionStatus;
  postedDate: string;
  deadline: string;
  bookmarked: boolean;
  applicantCount: number;
  logoURL?: string;
  posterUserId: string;
  roleTags: UserRole[];
  isRemote: boolean;
  location?: string;
  description: string;
  requirements: string[];
  compensation?: string;
  compensationMin?: number;
  compensationMax?: number;
  compensationPer?: CompensationPer;
  coverImage?: string;
  applicationUrl?: string;
}

export interface Application {
  id: string;
  opportunityId: string;
  applicantId: string;
  message: string;
  resumeUrl?: string;
  reelUrl?: string;
  appliedAt: string;
  profileSnapshot: {
    userId: string;
    name: string;
    avatar: string;
    role: UserRole;
    badges: string[];
    credits: { project: string; role: string; verified: boolean }[];
    unionStatus: string;
    location: string;
    verified: boolean;
  };
}

interface OpportunitiesState {
  opportunities: Opportunity[];
  applications: Application[];
  bookmarks: string[]; // opportunity IDs bookmarked by current user
  
  // Actions
  getOpportunities: (filters?: {
    role?: UserRole;
    paid?: boolean;
    remote?: boolean;
    keyword?: string;
  }) => Opportunity[];
  getOpportunity: (id: string) => Opportunity | undefined;
  createOpportunity: (opportunity: Omit<Opportunity, 'id' | 'postedDate' | 'applicantCount' | 'bookmarked'>) => string;
  toggleBookmark: (opportunityId: string) => void;
  isBookmarked: (opportunityId: string) => boolean;
  
  // Application actions
  applyToOpportunity: (application: Omit<Application, 'id' | 'appliedAt'>) => void;
  getApplications: (userId: string) => Application[];
  getUserPosts: (userId: string) => Opportunity[];
  hasApplied: (opportunityId: string, userId: string) => boolean;
  getApplicationsForOpportunity: (opportunityId: string) => Application[];
}

export const useOpportunitiesStore = create<OpportunitiesState>()(
  persist(
    (set, get) => ({
      opportunities: [],
      applications: [],
      bookmarks: [],
      
      getOpportunities: (filters) => {
        let opps = get().opportunities;
        
        if (filters?.role) {
          opps = opps.filter(o => o.roleTags.includes(filters.role!));
        }
        if (filters?.paid !== undefined) {
          opps = opps.filter(o => filters.paid ? o.paidStatus === 'Paid' : o.paidStatus === 'Unpaid');
        }
        if (filters?.remote !== undefined) {
          opps = opps.filter(o => o.isRemote === filters.remote);
        }
        if (filters?.keyword) {
          const kw = filters.keyword.toLowerCase();
          opps = opps.filter(o => 
            o.title.toLowerCase().includes(kw) || 
            o.companyName.toLowerCase().includes(kw) ||
            o.description.toLowerCase().includes(kw)
          );
        }
        
        // Sort by posted date, newest first
        return opps.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
      },
      
      getOpportunity: (id) => {
        return get().opportunities.find(o => o.id === id);
      },
      
      createOpportunity: (opportunity) => {
        const id = `opp-${Date.now()}`;
        const newOpp: Opportunity = {
          ...opportunity,
          id,
          postedDate: new Date().toISOString(),
          applicantCount: 0,
          bookmarked: false,
        };
        
        set(state => ({
          opportunities: [newOpp, ...state.opportunities]
        }));
        
        return id;
      },
      
      toggleBookmark: (opportunityId) => {
        set(state => {
          const isBookmarked = state.bookmarks.includes(opportunityId);
          return {
            bookmarks: isBookmarked 
              ? state.bookmarks.filter(id => id !== opportunityId)
              : [...state.bookmarks, opportunityId]
          };
        });
      },
      
      isBookmarked: (opportunityId) => {
        return get().bookmarks.includes(opportunityId);
      },
      
      applyToOpportunity: (application) => {
        const id = `app-${Date.now()}`;
        const newApp: Application = {
          ...application,
          id,
          appliedAt: new Date().toISOString(),
        };
        
        set(state => ({
          applications: [...state.applications, newApp],
          opportunities: state.opportunities.map(o => 
            o.id === application.opportunityId 
              ? { ...o, applicantCount: o.applicantCount + 1 }
              : o
          )
        }));
      },
      
      getApplications: (userId) => {
        return get().applications
          .filter(a => a.applicantId === userId)
          .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
      },
      
      getUserPosts: (userId) => {
        return get().opportunities
          .filter(o => o.posterUserId === userId)
          .sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
      },
      
      hasApplied: (opportunityId, userId) => {
        return get().applications.some(a => a.opportunityId === opportunityId && a.applicantId === userId);
      },
      
      getApplicationsForOpportunity: (opportunityId) => {
        return get().applications.filter(a => a.opportunityId === opportunityId);
      },
    }),
    {
      name: 'inlight-opportunities-storage',
    }
  )
);
