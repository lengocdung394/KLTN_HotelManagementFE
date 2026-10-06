package iuh.fit.se.hotelmanagement_be.modular.branch.services.impl;

import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Floor;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.FloorRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.BuildingResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.FloorResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.services.FloorService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class FloorServiceImpl implements FloorService {
    FloorRepository floorRepository;

    @Override
    public List<FloorResponse> getFloorsByBuildingId(String buildingId, Long hotelId) {
        List<Floor> floors = hotelId == null
                ? floorRepository.findByBuilding_Id(buildingId)
                : floorRepository.findByBuilding_IdAndBuilding_Hotel_Id(buildingId, hotelId);
        return floors.stream()
                .map(floor -> FloorResponse.builder()
                        .id(floor.getId())
                        .floorNumber(floor.getFloorNumber())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    public List<FloorResponse> getAllFloors(Long hotelId) {
        return floorRepository.findByBuilding_Hotel_Id(hotelId).stream()
                .map(floor -> FloorResponse.builder()
                        .id(floor.getId())
                        .floorNumber(floor.getFloorNumber())
                        .building(BuildingResponse.builder()
                                .id(floor.getBuilding().getId())
                                .name(floor.getBuilding().getName())
                                .build())
                        .build())
                .collect(Collectors.toList());
    }
}
