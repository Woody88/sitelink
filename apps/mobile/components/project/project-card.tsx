import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Check, FileText, MapPin, Users } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export interface Project {
  id: string;
  name: string;
  address?: string;
  sheetCount: number;
  photoCount: number;
  memberCount: number;
  updatedAt: string;
  status: 'active' | 'archived' | 'completed';
}

interface ProjectCardProps {
  project: Project;
  onPress?: (project: Project) => void;
  className?: string;
  isActive?: boolean;
}

export function ProjectCard({ project, className, onPress, isActive }: ProjectCardProps) {
  return (
    <Pressable onPress={() => onPress?.(project)}>
      <Card 
        className={cn(
            'w-full transition-all', 
            isActive && 'border-primary ring-2 ring-primary',
            className
        )}
      >
        <CardHeader>
          <View className="flex-row items-center justify-between">
              <CardTitle className="text-xl">{project.name}</CardTitle>
              {isActive ? (
                <Badge variant="default" className="gap-1">
                    <Check size={12} className="text-primary-foreground" />
                    <Text className="text-primary-foreground text-xs">Selected</Text>
                </Badge>
              ) : (
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    <Text className={cn("text-xs capitalize", project.status === 'active' ? 'text-primary-foreground' : 'text-secondary-foreground')}>{project.status}</Text>
                </Badge>
              )}
          </View>
          {project.address && (
            <View className="flex-row items-center mt-1">
              <MapPin size={14} className="text-muted-foreground mr-1" />
              <CardDescription>{project.address}</CardDescription>
            </View>
          )}
        </CardHeader>
        <CardContent>
          <View className="flex-row gap-4">
              <View className="flex-row items-center">
                  <FileText size={16} className="text-muted-foreground mr-1.5" />
                  <Text className="text-sm text-muted-foreground">{project.sheetCount} sheets</Text>
              </View>
              <View className="flex-row items-center">
                  <Users size={16} className="text-muted-foreground mr-1.5" />
                  <Text className="text-sm text-muted-foreground">{project.memberCount} members</Text>
              </View>
          </View>
        </CardContent>
        <CardFooter className="justify-between border-t border-border pt-4">
          <Text className="text-xs text-muted-foreground">Updated {project.updatedAt}</Text>
        </CardFooter>
      </Card>
    </Pressable>
  );
}
