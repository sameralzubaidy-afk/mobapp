import { supabase } from './supabase';

/**
 * Assign user to nearest geographic node based on ZIP code
 * Uses direct database query (not RPC) to find nearest node
 */
export const assignNodeByZipCode = async (zipCode: string): Promise<string> => {
  try {
    // Get coordinates for ZIP code using Zippopotam API
    const coords = await getZipCodeCoordinates(zipCode);
    if (!coords) {
      throw new Error('Failed to get coordinates for ZIP code');
    }

    console.log('🗺️ ZIP coords:', { zipCode, ...coords });

    // Query nodes directly using raw SQL via Supabase
    // Find the nearest active node by distance
    const { data, error } = await supabase
      .from('nodes')
      .select('id, name, latitude, longitude')
      .eq('status', 'active')
      .limit(100); // Get all active nodes, we'll calculate distance in JS

    if (error) {
      console.error('❌ Nodes query error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('❌ No active nodes found in database');
      throw new Error('No active nodes found in database');
    }

    console.log(`✅ Found ${data.length} nodes, calculating distances...`);

    // Calculate distance for each node using simple distance formula
    const nodesWithDistance = (data as any[]).map((node) => {
      const distance = Math.sqrt(
        Math.pow(node.latitude - coords.latitude, 2) +
        Math.pow(node.longitude - coords.longitude, 2)
      );
      return { ...node, distance };
    });

    // Sort by distance and get nearest
    nodesWithDistance.sort((a, b) => a.distance - b.distance);
    const nearestNode = nodesWithDistance[0];

    console.log(`✅ Nearest node: ${nearestNode.name} (distance: ${nearestNode.distance.toFixed(3)})`);

    return nearestNode.id;
  } catch (error) {
    console.error('❌ assignNodeByZipCode error:', error);
    throw error;
  }
};

/**
 * Get latitude/longitude coordinates for a ZIP code
 * Uses free Zippopotam API
 */
const getZipCodeCoordinates = async (
  zipCode: string
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.places || data.places.length === 0) {
      return null;
    }

    const place = data.places[0];
    return {
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
    };
  } catch (error) {
    console.error('getZipCodeCoordinates error:', error);
    return null;
  }
};
