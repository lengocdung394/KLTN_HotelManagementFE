package iuh.fit.se.hotelmanagement_be.modular.branch.repositories;

import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Floor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FloorRepository extends JpaRepository<Floor,String> {
    List<Floor> findByBuilding_Id(String buildingId);
    List<Floor> findByBuilding_IdAndBuilding_Hotel_Id(String buildingId, Long hotelId);
    boolean existsByBuilding_IdAndFloorNumber(String buildingId, int floorNumber);
    // Lấy các Floor thuộc về Building của Hotel này
    List<Floor> findByBuilding_Hotel_Id(Long hotelId);

    Optional<Floor> findByIdAndBuilding_Hotel_Id(String floorId, Long hotelId);
}
